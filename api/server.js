import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function getOppositeSide(side) {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'right':
      return 'left';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    default:
      return 'right';
  }
}

function getHandleSide(from, to) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'bottom' : 'top';
}

function normalizePoint(node) {
  if (!node) return null;

  if (node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number') {
    return node.position;
  }

  if (typeof node.posicao_x === 'number' && typeof node.posicao_y === 'number') {
    return { x: node.posicao_x, y: node.posicao_y };
  }

  if (typeof node.x === 'number' && typeof node.y === 'number') {
    return { x: node.x, y: node.y };
  }

  return null;
}

function resolveConnectionHandles(sourceNode, targetNode, connection) {
  const sourcePoint = normalizePoint(sourceNode);
  const targetPoint = normalizePoint(targetNode);

  if (!sourcePoint || !targetPoint) {
    return {
      sourceHandle: connection?.sourceHandle || 'right',
      targetHandle: connection?.targetHandle || 'left'
    };
  }

  const sourceHandle = connection?.sourceHandle || getHandleSide(sourcePoint, targetPoint);
  const targetHandle = connection?.targetHandle || getOppositeSide(sourceHandle);

  return { sourceHandle, targetHandle };
}

function getEdgeColorByType(tipo) {
  switch (tipo) {
    case 'painel':
      return '#22c55e';
    case 'tabela':
      return '#3b82f6';
    case 'componente_web':
      return '#ec4899';
    case 'service':
      return '#ef4444';
    default:
      return '#22c55e';
  }
}

async function deleteFlowCascade(visaoId) {
  const { error: errConexoes } = await supabase
    .from('fluxo_conexoes')
    .delete()
    .eq('visao_id', visaoId);

  if (errConexoes) return errConexoes;

  const { error: errNos } = await supabase
    .from('fluxo_nos_posicoes')
    .delete()
    .eq('visao_id', visaoId);

  if (errNos) return errNos;

  const { error: errVisao } = await supabase
    .from('fluxos_visoes')
    .delete()
    .eq('id', visaoId);

  return errVisao;
}

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
      ...resolveConnectionHandles(
        nos.find(no => no.id === edge.origem_no_id),
        nos.find(no => no.id === edge.destino_no_id),
        edge
      ),
      animated: true,
      sourceType: nos.find(no => no.id === edge.origem_no_id)?.catalogo_componentes?.tipo,
      style: { stroke: getEdgeColorByType(nos.find(no => no.id === edge.origem_no_id)?.catalogo_componentes?.tipo) }
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

// 2.1 CRUD: CRIAR UMA NOVA VISÃO / HALL
app.post('/api/visoes', async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) {
    return res.status(400).json({ error: 'Nome obrigatório' });
  }

  const { data, error } = await supabase
    .from('fluxos_visoes')
    .insert({ nome: nome.trim() })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// 2.2 CRUD: RENOMEAR UMA VISÃO / HALL
app.patch('/api/visoes/:id', async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) {
    return res.status(400).json({ error: 'Nome obrigatório' });
  }

  const { data, error } = await supabase
    .from('fluxos_visoes')
    .update({ nome: nome.trim() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 2.3 CRUD: REMOVER UMA VISÃO / HALL
app.delete('/api/visoes/:id', async (req, res) => {
  const error = await deleteFlowCascade(req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.sendStatus(204);
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
  const { data: nodes, error: errNodes } = await supabase
    .from('fluxo_nos_posicoes')
    .select('id, posicao_x, posicao_y')
    .eq('visao_id', visaoId)
    .in('id', [source, target]);

  if (errNodes) return res.status(400).json({ error: errNodes.message });

  const sourceNode = nodes.find(no => no.id === source);
  const targetNode = nodes.find(no => no.id === target);
  const sourceType = sourceNode?.catalogo_componentes?.tipo;
  const resolvedHandles = sourceNode && targetNode
    ? resolveConnectionHandles(
        { x: sourceNode.posicao_x, y: sourceNode.posicao_y },
        { x: targetNode.posicao_x, y: targetNode.posicao_y }
      )
    : {};

  const { data, error } = await supabase
    .from('fluxo_conexoes')
    .insert({ visao_id: visaoId, origem_no_id: source, destino_no_id: target })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ ...data, ...resolvedHandles, sourceType, style: { stroke: getEdgeColorByType(sourceType) } });
});

// 4.1 CRUD: REMOVER CONEXÃO (EDGE)
app.delete('/api/fluxo/conexao/:id', async (req, res) => {
  const { error } = await supabase.from('fluxo_conexoes').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.sendStatus(204);
});

// 5. CRUD: ATUALIZAR POSIÇÃO (PATCH COM DEBOUNCE DO FRONTEND)
app.patch('/api/fluxo/no/posicao', async (req, res) => {
  const { noId, posicao_x, posicao_y } = req.body;
  const { error } = await supabase
    .from('fluxo_nos_posicoes')
    .update({ posicao_x, posicao_y })
    .eq('id', noId);

  if (error) return res.status(400).json({ error: error.message });
  res.sendStatus(204);
});

// 5.1 CRUD: EDITAR NOME DO COMPONENTE
app.patch('/api/fluxo/no/nome', async (req, res) => {
  try {
    const { noId, nome } = req.body;

    // Busca o componente_id correspondente à instância do nó
    const { data: no, error: errNo } = await supabase
      .from('fluxo_nos_posicoes')
      .select('componente_id')
      .eq('id', noId)
      .single();

    if (errNo || !no) return res.status(400).json({ error: errNo?.message || 'Nó não encontrado' });

    // Atualiza o nome do componente no catálogo
    const { error: errComp } = await supabase
      .from('catalogo_componentes')
      .update({ nome })
      .eq('id', no.componente_id);

    if (errComp) return res.status(400).json({ error: errComp.message });
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. CRUD: REMOVER INSTÂNCIA DO FLUXO (E CASCASE EDGES)
app.delete('/api/fluxo/no/:id', async (req, res) => {
  const nodeId = req.params.id;

  const { error: errEdges } = await supabase
    .from('fluxo_conexoes')
    .delete()
    .or(`origem_no_id.eq.${nodeId},destino_no_id.eq.${nodeId}`);

  if (errEdges) return res.status(400).json({ error: errEdges.message });

  const { error } = await supabase.from('fluxo_nos_posicoes').delete().eq('id', nodeId);
  if (error) return res.status(400).json({ error: error.message });
  res.sendStatus(204);
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
}

export default app;
