import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 1. BUSCAR FLUXO COMPLETO (Nodes e Edges formatados para o React Flow)
app.get('/api/fluxo/:visaoId', async (req, res) => {
  try {
    const { visaoId } = req.params;

    const { data: nos, error: errNos } = await supabase
      .from('fluxo_nos_posicoes')
      .select('id, posicao_x, posicao_y, catalogo_componentes(nome, tipo)')
      .eq('visao_id', visaoId);

    if (errNos) return res.status(400).json({ error: errNos.message });

    const { data: conexoes, error: errConexoes } = await supabase
      .from('fluxo_conexoes')
      .select('id, origem_no_id, destino_no_id')
      .eq('visao_id', visaoId);

    if (errConexoes) return res.status(400).json({ error: errConexoes.message });

    const nodes = nos.map(no => ({
      id: no.id,
      type: no.catalogo_componentes.tipo,
      position: { x: no.posicao_x, y: no.posicao_y },
      data: { label: no.catalogo_componentes.nome }
    }));

    const edges = conexoes.map(edge => ({
      id: edge.id,
      source: edge.origem_no_id,
      target: edge.destino_no_id,
      animated: true,
      style: { stroke: '#4b5563' }
    }));

    res.json({ nodes, edges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. LISTAR AS VISÕES DISPONÍVEIS
app.get('/api/visoes', async (req, res) => {
  const { data, error } = await supabase.from('fluxos_visoes').select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 3. CRUD: CRIAR NOVO COMPONENTE E ADICIONAR AO FLUXO
app.post('/api/fluxo/no', async (req, res) => {
  try {
    const { visaoId, nome, tipo } = req.body;

    const { data: comp, error: errComp } = await supabase
      .from('catalogo_componentes')
      .upsert({ nome, tipo }, { onConflict: 'nome' })
      .select()
      .single();

    if (errComp) return res.status(400).json({ error: errComp.message });

    const { data: noPos, error: errNoPos } = await supabase
      .from('fluxo_nos_posicoes')
      .insert({ visao_id: visaoId, componente_id: comp.id })
      .select('id, posicao_x, posicao_y')
      .single();

    if (errNoPos) return res.status(400).json({ error: errNoPos.message });

    res.status(201).json({
      id: noPos.id,
      type: tipo,
      position: { x: noPos.posicao_x, y: noPos.posicao_y },
      data: { label: nome }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. CRUD: CRIAR CONEXÃO (EDGE)
app.post('/api/fluxo/conexao', async (req, res) => {
  const { visaoId, source, target } = req.body;
  const { data, error } = await supabase
    .from('fluxo_conexoes')
    .insert({ visao_id: visaoId, origem_no_id: source, destino_no_id: target })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// 5. CRUD: ATUALIZAR POSIÇÃO (PATCH COM DEBOUNCE DO FRONTEND)
app.patch('/api/fluxo/no/posicao', async (req, res) => {
  const { noId, posicao_x, posicao_y } = req.body;
  const { error } = await supabase
    .from('fluxo_nos_posicoes')
    .update({ posicao_x, posicao_y })
    .eq('id', noId);

  if (error) return res.status(4000).json({ error: error.message });
  res.sendStatus(204);
});

// 6. CRUD: REMOVER INSTÂNCIA DO FLUXO (E CASCASE EDGES)
app.delete('/api/fluxo/no/:id', async (req, res) => {
  const { error } = await supabase.from('fluxo_nos_posicoes').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.sendStatus(204);
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
}

export default app;
