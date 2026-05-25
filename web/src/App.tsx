import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  NodeDragHandler,
  Position,
  addEdge,
  Connection,
  useEdgesState,
  useNodesState
} from 'reactflow';
import axios from 'axios';
import 'reactflow/dist/style.css';

const API_URL = (import.meta as any).env.VITE_API_URL || ((import.meta as any).env.DEV ? 'http://localhost:3001/api' : '/api');

const nodeOptions = [
  { type: 'painel', label: 'Painel', emoji: '📊', className: 'painel-node' },
  { type: 'componente_web', label: 'Componente Web', emoji: '💻', className: 'web-node' },
  { type: 'service', label: 'Service / API', emoji: '⚙️', className: 'service-node' },
  { type: 'tabela', label: 'Tabela / View', emoji: '🛢️', className: 'tabela-node' }
] as const;

type NodeOptionType = (typeof nodeOptions)[number]['type'];

const nodeByType = nodeOptions.reduce<Record<string, (typeof nodeOptions)[number]>>((acc, option) => {
  acc[option.type] = option;
  return acc;
}, {});

const nodeTypes = {
  painel: ({ data }: any) => <FlowNode data={data} className="painel-node" emoji="📊" />,
  componente_web: ({ data }: any) => <FlowNode data={data} className="web-node" emoji="💻" />,
  service: ({ data }: any) => <FlowNode data={data} className="service-node" emoji="⚙️" />,
  tabela: ({ data }: any) => <FlowNode data={data} className="tabela-node" emoji="🛢️" />
};

function FlowNode({ data, className, emoji }: { data: any; className: string; emoji: string }) {
  return (
    <div className={`custom-node ${className}`}>
      <Handle type="target" position={Position.Left} style={{ background: '#64748b', width: 8, height: 8 }} />
      <div className="node-emoji">{emoji}</div>
      <div className="node-label">{data.label}</div>
      <Handle type="source" position={Position.Right} style={{ background: '#64748b', width: 8, height: 8 }} />
    </div>
  );
}

function NodeEditor({
  node,
  selected,
  onSelect,
  onRename,
  onDelete
}: {
  node: any;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onRename: (nodeId: string, nextName: string) => void;
  onDelete: (nodeId: string) => void;
}) {
  const [draft, setDraft] = useState(node.data.label ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    setDraft(node.data.label ?? '');
  }, [node.data.label]);

  useEffect(() => {
    if (draft === (node.data.label ?? '')) return;

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }

    saveTimer.current = window.setTimeout(async () => {
      if (!draft.trim() || draft.trim() === (node.data.label ?? '')) return;
      setIsSaving(true);
      try {
        await onRename(node.id, draft.trim());
      } finally {
        setIsSaving(false);
      }
    }, 550);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [draft, node.data.label, node.id, onRename]);

  const option = nodeByType[node.type] ?? nodeByType.tabela;

  return (
    <div className={`crud-item ${selected ? 'is-selected' : ''}`} onClick={() => onSelect(node.id)}>
      <div className="crud-item-top">
        <div>
          <div className="crud-item-title">
            <span className="crud-item-emoji">{option.emoji}</span>
            <span>{option.label}</span>
          </div>
          <div className="crud-item-id">ID: {node.id}</div>
        </div>
        <button className="btn-ghost" type="button" onClick={() => onDelete(node.id)}>
          Remover
        </button>
      </div>

      <label className="field-label">
        Nome
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft.trim() && draft.trim() !== node.data.label) {
              onRename(node.id, draft.trim());
            }
          }}
        />
      </label>

      <div className={`save-hint ${isSaving ? 'is-saving' : ''}`}>
        {isSaving ? 'Salvando automaticamente...' : 'Auto-save ativo'}
      </div>
    </div>
  );
}

function CreateModal({
  isOpen,
  initialType,
  onClose,
  onCreate
}: {
  isOpen: boolean;
  initialType: NodeOptionType;
  onClose: () => void;
  onCreate: (payload: { nome: string; tipo: NodeOptionType }) => Promise<void>;
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<NodeOptionType>(initialType);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNome('');
    setTipo(initialType);
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!nome.trim()) return;

    setIsSaving(true);
    try {
      await onCreate({ nome: nome.trim(), tipo });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Novo item</h3>
            <p>Escolha o nome e o tipo antes de inserir no canvas.</p>
          </div>
          <button className="btn-ghost" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="field-label">
            Nome
            <input
              autoFocus
              type="text"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex: cmc_hospital.tbl_exemplo"
            />
          </label>

          <div className="type-grid">
            {nodeOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                className={`type-card ${tipo === option.type ? 'active' : ''}`}
                onClick={() => setTipo(option.type)}
              >
                <span className="type-card-emoji">{option.emoji}</span>
                <span className="type-card-label">{option.label}</span>
              </button>
            ))}
          </div>

          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Criar item'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [visoes, setVisoes] = useState<any[]>([]);
  const [currentVisao, setCurrentVisao] = useState<string>('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<NodeOptionType>('tabela');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

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

  const handleCreateNode = useCallback(
    async ({ nome, tipo }: { nome: string; tipo: NodeOptionType }) => {
      const res = await axios.post(`${API_URL}/fluxo/no`, {
        visaoId: currentVisao,
        nome,
        tipo
      });

      setNodes((nds) => nds.concat(res.data));
      setSelectedNodeId(res.data.id);
    },
    [currentVisao, setNodes]
  );

  const handleRenameNode = useCallback(
    async (nodeId: string, nextName: string) => {
      await axios.patch(`${API_URL}/fluxo/no/nome`, {
        noId: nodeId,
        nome: nextName
      });

      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, label: nextName }
              }
            : node
        )
      );
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      const confirmacao = window.confirm('Deseja realmente remover este item do fluxo?');
      if (!confirmacao) return;

      await axios.delete(`${API_URL}/fluxo/no/${nodeId}`);
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId('');
    },
    [selectedNodeId, setEdges, setNodes]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      axios
        .post(`${API_URL}/fluxo/conexao`, {
          visaoId: currentVisao,
          source: params.source,
          target: params.target
        })
        .then(() => {
          setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#4b5563' } }, eds));
        })
        .catch((err) => alert(err.response?.data?.error || 'Erro ao conectar'));
    },
    [currentVisao, setEdges]
  );

  const onNodeDragStop: NodeDragHandler = useCallback((_event, node) => {
    axios.patch(`${API_URL}/fluxo/no/posicao`, {
      noId: node.id,
      posicao_x: node.position.x,
      posicao_y: node.position.y
    });
  }, []);

  const toolbar = useMemo(
    () => (
      <div className="top-toolbar">
        {nodeOptions.map((option) => (
          <button
            key={option.type}
            type="button"
            className="toolbar-chip"
            onClick={() => {
              setCreateType(option.type);
              setIsCreateOpen(true);
            }}
            title={option.label}
            aria-label={option.label}
          >
            <span>{option.emoji}</span>
          </button>
        ))}
      </div>
    ),
    []
  );

  const visibleNodes = useMemo(() => nodes.slice().sort((a, b) => {
    if (a.id === selectedNodeId) return -1;
    if (b.id === selectedNodeId) return 1;
    return a.id.localeCompare(b.id);
  }), [nodes, selectedNodeId]);

  return (
    <div className="app-container">
      <main className="canvas-container">
        {toolbar}

        <div className="canvas-footer">
          <div>
            <strong>Auto-save</strong>
            <span>Posição e nome salvam automaticamente no canvas.</span>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setCreateType('tabela');
              setIsCreateOpen(true);
            }}
          >
            Criar
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#2a2f3b" gap={20} size={1} />
          <Controls />
        </ReactFlow>

        <aside className="crud-panel">
          <div className="panel-header">
            <div>
              <h2>CRUD</h2>
              <p>Criar, editar e remover itens sem sair do canvas.</p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setCreateType('tabela');
                setIsCreateOpen(true);
              }}
            >
              + Criar
            </button>
          </div>

          <label className="field-label">
            Visão
            <select value={currentVisao} onChange={(event) => setCurrentVisao(event.target.value)}>
              {visoes.map((visao) => (
                <option key={visao.id} value={visao.id}>
                  {visao.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="panel-divider" />

          <div className="crud-list">
            {visibleNodes.length === 0 ? (
              <div className="empty-state">Nenhum item criado ainda.</div>
            ) : (
              visibleNodes.map((node) => (
              <NodeEditor
                  key={node.id}
                  node={node}
                  selected={node.id === selectedNodeId}
                  onSelect={setSelectedNodeId}
                  onRename={handleRenameNode}
                  onDelete={handleDeleteNode}
                />
              ))
            )}
          </div>
        </aside>
      </main>

      <CreateModal
        isOpen={isCreateOpen}
        initialType={createType}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateNode}
      />
    </div>
  );
}
