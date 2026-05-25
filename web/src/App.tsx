import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, addEdge, Connection, NodeDragHandler, Handle, Position } from 'reactflow';
import axios from 'axios';
import 'reactflow/dist/style.css';

const API_URL = (import.meta as any).env.VITE_API_URL || ((import.meta as any).env.DEV ? 'http://localhost:3001/api' : '/api');

const nodeTypes = {
  painel: ({ data }: any) => (
    <div className="custom-node painel-node" style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8 }} />
      📊 {data.label}
      <Handle type="source" position={Position.Right} style={{ background: '#555', width: 8, height: 8 }} />
    </div>
  ),
  componente_web: ({ data }: any) => (
    <div className="custom-node web-node" style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8 }} />
      💻 {data.label}
      <Handle type="source" position={Position.Right} style={{ background: '#555', width: 8, height: 8 }} />
    </div>
  ),
  service: ({ data }: any) => (
    <div className="custom-node service-node" style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8 }} />
      ⚙️ {data.label}
      <Handle type="source" position={Position.Right} style={{ background: '#555', width: 8, height: 8 }} />
    </div>
  ),
  tabela: ({ data }: any) => (
    <div className="custom-node tabela-node" style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8 }} />
      🛢️ {data.label}
      <Handle type="source" position={Position.Right} style={{ background: '#555', width: 8, height: 8 }} />
    </div>
  ),
};

export default function App() {
  const [visoes, setVisoes] = useState<any[]>([]);
  const [currentVisao, setCurrentVisao] = useState<string>('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [novoNome, setNovoNome] = useState('');
  const [novoTipo, setNovoTipo] = useState('tabela');

  useEffect(() => {
    axios.get(`${API_URL}/visoes`).then((res) => {
      setVisoes(res.data);
      if (res.data.length > 0) setCurrentVisao(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (currentVisao) {
      axios.get(`${API_URL}/fluxo/${currentVisao}`).then((res) => {
        setNodes(res.data.nodes);
        setEdges(res.data.edges);
      });
    }
  }, [currentVisao, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    
    axios.post(`${API_URL}/fluxo/conexao`, {
      visaoId: currentVisao,
      source: params.source,
      target: params.target
    }).then(() => {
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#4b5563' } }, eds));
    }).catch(err => alert(err.response?.data?.error || 'Erro ao conectar'));
  }, [currentVisao, setEdges]);

  const onNodeDragStop: NodeDragHandler = useCallback((_event, node) => {
    axios.patch(`${API_URL}/fluxo/no/posicao`, {
      noId: node.id,
      posicao_x: node.position.x,
      posicao_y: node.position.y
    });
  }, []);

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;

    axios.post(`${API_URL}/fluxo/no`, {
      visaoId: currentVisao,
      nome: novoNome,
      tipo: novoTipo
    }).then((res) => {
      setNodes((nds) => nds.concat(res.data));
      setNovoNome('');
    }).catch(err => alert(err.response?.data?.error || 'Erro ao adicionar'));
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h2>Linhagem Command Center</h2>
        
        <div className="form-group">
          <label>Selecione a Visão</label>
          <select value={currentVisao} onChange={(e) => setCurrentVisao(e.target.value)}>
            {visoes.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </div>

        <hr className="divider" />

        <form onSubmit={handleAddNode}>
          <h3>Incluir Novo Item</h3>
          <div className="form-group">
            <label>Nome do Componente / Tabela</label>
            <input 
              type="text" 
              placeholder="Ex: cmc_hospital.tbl_exemplo" 
              value={novoNome} 
              onChange={(e) => setNovoNome(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label>Tipo de Elemento</label>
            <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)}>
              <option value="painel">📊 Painel</option>
              <option value="componente_web">💻 Componente Web</option>
              <option value="service">⚙️ Service / API</option>
              <option value="tabela">🛢️ Tabela / View</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">Adicionar ao Fluxo</button>
        </form>

        <div className="instructions">
          <p>💡 <strong>Dica:</strong> Arraste as esferas laterais dos nós para interligá-los e criar linhagens dinamicamente.</p>
        </div>
      </aside>

      <main className="canvas-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#2a2f3b" gap={20} size={1} />
          <Controls />
        </ReactFlow>
      </main>
    </div>
  );
}
