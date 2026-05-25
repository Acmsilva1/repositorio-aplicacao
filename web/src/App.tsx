import { useCallback, useEffect, useMemo, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  Edge,
  Handle,
  Node,
  NodeDragHandler,
  NodeProps,
  Position,
  useEdgesState,
  useNodesState
} from 'reactflow';
import axios from 'axios';
import 'reactflow/dist/style.css';

const API_URL =
  (import.meta as any).env.VITE_API_URL || ((import.meta as any).env.DEV ? 'http://localhost:3001/api' : '/api');

const nodeOptions = [
  { type: 'painel', label: 'Painel', emoji: '📊', className: 'painel-node' },
  { type: 'componente_web', label: 'Componente Web', emoji: '💻', className: 'web-node' },
  { type: 'service', label: 'Service / API', emoji: '⚙️', className: 'service-node' },
  { type: 'tabela', label: 'Tabela / View', emoji: '🛢️', className: 'tabela-node' }
] as const;

type FlowType = (typeof nodeOptions)[number]['type'];
type FlowMode = 'hall' | 'canvas';
type VisaoItem = { id: string; nome: string };
type FlowNodeData = { label: string };
type FlowNode = Node<FlowNodeData, FlowType>;

const nodeOptionByType = nodeOptions.reduce<Record<FlowType, (typeof nodeOptions)[number]>>(
  (acc, option) => {
    acc[option.type] = option;
    return acc;
  },
  {} as Record<FlowType, (typeof nodeOptions)[number]>
);

const nodeTypes = {
  painel: (props: NodeProps<FlowNodeData>) => <CanvasNode {...props} />,
  componente_web: (props: NodeProps<FlowNodeData>) => <CanvasNode {...props} />,
  service: (props: NodeProps<FlowNodeData>) => <CanvasNode {...props} />,
  tabela: (props: NodeProps<FlowNodeData>) => <CanvasNode {...props} />
};

function CanvasNode({ data, type }: NodeProps<FlowNodeData>) {
  const option = nodeOptionByType[(type as FlowType) ?? 'tabela'];

  return (
    <div className={`custom-node ${option.className}`}>
      <Handle type="target" position={Position.Left} style={{ background: '#64748b', width: 8, height: 8 }} />
      <div className="node-emoji">{option.emoji}</div>
      <div className="node-label">{data.label}</div>
      <Handle type="source" position={Position.Right} style={{ background: '#64748b', width: 8, height: 8 }} />
    </div>
  );
}

function HallModal({
  open,
  title,
  description,
  initialValue,
  submitLabel,
  onClose,
  onSubmit
}: {
  open: boolean;
  title: string;
  description: string;
  initialValue: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;

    setSaving(true);
    try {
      await onSubmit(value);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Nome
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ex: Painel x"
            />
          </label>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

function NodeModal({
  open,
  initialType,
  onClose,
  onSubmit
}: {
  open: boolean;
  initialType: FlowType;
  onClose: () => void;
  onSubmit: (payload: { nome: string; tipo: FlowType }) => Promise<void>;
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<FlowType>(initialType);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome('');
      setTipo(initialType);
    }
  }, [open, initialType]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = nome.trim();
    if (!value) return;

    setSaving(true);
    try {
      await onSubmit({ nome: value, tipo });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Novo item no canvas</h3>
            <p>Escolha o tipo pelo ícone e informe o nome do item.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
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

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Criar item'}
          </button>
        </form>
      </div>
    </div>
  );
}

function HallCard({
  visao,
  onOpen,
  onEdit,
  onDelete
}: {
  visao: VisaoItem;
  onOpen: (visao: VisaoItem) => void;
  onEdit: (visao: VisaoItem) => void;
  onDelete: (visao: VisaoItem) => void;
}) {
  return (
    <article className="hall-card">
      <button className="hall-card-main" type="button" onClick={() => onOpen(visao)}>
        <div className="hall-card-badge">📁</div>
        <div className="hall-card-copy">
          <strong>{visao.nome}</strong>
          <span>ID: {visao.id}</span>
        </div>
      </button>

      <div className="hall-card-actions">
        <button type="button" className="btn-ghost" onClick={() => onEdit(visao)}>
          Editar
        </button>
        <button type="button" className="btn-ghost danger" onClick={() => onDelete(visao)}>
          Excluir
        </button>
      </div>
    </article>
  );
}

export default function App() {
  const [mode, setMode] = useState<FlowMode>('hall');
  const [visoes, setVisoes] = useState<VisaoItem[]>([]);
  const [currentVisao, setCurrentVisao] = useState<VisaoItem | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [isHallModalOpen, setIsHallModalOpen] = useState(false);
  const [hallModalMode, setHallModalMode] = useState<'create' | 'edit'>('create');
  const [editingVisao, setEditingVisao] = useState<VisaoItem | null>(null);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [nodeModalType, setNodeModalType] = useState<FlowType>('tabela');

  const loadVisoes = useCallback(async () => {
    const res = await axios.get(`${API_URL}/visoes`);
    setVisoes(res.data);
  }, []);

  const loadFlow = useCallback(async (visaoId: string) => {
    const res = await axios.get(`${API_URL}/fluxo/${visaoId}`);
    setNodes(res.data.nodes);
    setEdges(res.data.edges);
  }, [setEdges, setNodes]);

  useEffect(() => {
    loadVisoes().catch((error) => alert(error.response?.data?.error || 'Erro ao carregar hall'));
  }, [loadVisoes]);

  useEffect(() => {
    if (mode === 'canvas' && currentVisao) {
      loadFlow(currentVisao.id).catch((error) => alert(error.response?.data?.error || 'Erro ao carregar canvas'));
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [currentVisao, loadFlow, mode, setEdges, setNodes]);

  const openHallCreate = useCallback(() => {
    setHallModalMode('create');
    setEditingVisao(null);
    setIsHallModalOpen(true);
  }, []);

  const openHallEdit = useCallback((visao: VisaoItem) => {
    setHallModalMode('edit');
    setEditingVisao(visao);
    setIsHallModalOpen(true);
  }, []);

  const openCanvas = useCallback((visao: VisaoItem) => {
    setCurrentVisao(visao);
    setMode('canvas');
  }, []);

  const closeCanvas = useCallback(() => {
    setMode('hall');
    setCurrentVisao(null);
    setIsNodeModalOpen(false);
  }, []);

  const handleHallSubmit = useCallback(
    async (nome: string) => {
      if (hallModalMode === 'create') {
        await axios.post(`${API_URL}/visoes`, { nome });
      } else if (editingVisao) {
        await axios.patch(`${API_URL}/visoes/${editingVisao.id}`, { nome });
      }

      await loadVisoes();
    },
    [editingVisao, hallModalMode, loadVisoes]
  );

  const handleDeleteVisao = useCallback(
    async (visao: VisaoItem) => {
      const confirmacao = window.confirm(`Excluir o fluxograma "${visao.nome}"?`);
      if (!confirmacao) return;

      await axios.delete(`${API_URL}/visoes/${visao.id}`);
      await loadVisoes();

      if (currentVisao?.id === visao.id) {
        closeCanvas();
      }
    },
    [closeCanvas, currentVisao, loadVisoes]
  );

  const handleCreateNode = useCallback(
    async ({ nome, tipo }: { nome: string; tipo: FlowType }) => {
      if (!currentVisao) return;

      const res = await axios.post(`${API_URL}/fluxo/no`, {
        visaoId: currentVisao.id,
        nome,
        tipo
      });

      setNodes((prev) => prev.concat(res.data));
    },
    [currentVisao, setNodes]
  );

  const handleRenameNode = useCallback(
    async (nodeId: string, nextName: string) => {
      await axios.patch(`${API_URL}/fluxo/no/nome`, {
        noId: nodeId,
        nome: nextName
      });

      setNodes((prev) =>
        prev.map((node) =>
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
      await axios.delete(`${API_URL}/fluxo/no/${nodeId}`);
      setNodes((prev) => prev.filter((node) => node.id !== nodeId));
      setEdges((prev) => prev.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    },
    [setEdges, setNodes]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!currentVisao || !params.source || !params.target) return;

      axios
        .post(`${API_URL}/fluxo/conexao`, {
          visaoId: currentVisao.id,
          source: params.source,
          target: params.target
        })
        .then((res) => {
          setEdges((prev) =>
            addEdge(
              {
                ...params,
                id: res.data.id,
                animated: true,
                style: { stroke: '#22c55e' }
              },
              prev
            )
          );
        })
        .catch((error) => alert(error.response?.data?.error || 'Erro ao conectar'));
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

  const onNodeDoubleClick = useCallback(
    (_event: ReactMouseEvent, node: Node<FlowNodeData>) => {
      const novoNome = window.prompt('Editar nome do item:', node.data.label);
      if (!novoNome?.trim() || novoNome.trim() === node.data.label) return;
      handleRenameNode(node.id, novoNome.trim()).catch((error) =>
        alert(error.response?.data?.error || 'Erro ao renomear item')
      );
    },
    [handleRenameNode]
  );

  const onNodesDelete = useCallback(
    (nodesToDelete: Node<FlowNodeData>[]) => {
      Promise.all(nodesToDelete.map((node) => handleDeleteNode(node.id))).catch((error) =>
        alert(error.response?.data?.error || 'Erro ao remover item')
      );
    },
    [handleDeleteNode]
  );

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      Promise.all(edgesToDelete.map((edge) => axios.delete(`${API_URL}/fluxo/conexao/${edge.id}`)))
        .then(() => {
          const deletedIds = edgesToDelete.map((edge) => edge.id);
          setEdges((prev) => prev.filter((edge) => !deletedIds.includes(edge.id)));
        })
        .catch((error) => alert(error.response?.data?.error || 'Erro ao remover conexão'));
    },
    [setEdges]
  );

  const toolbar = useMemo(
    () => (
      <div className="top-toolbar">
        {nodeOptions.map((option) => (
          <button
            key={option.type}
            type="button"
            className="toolbar-chip"
            onClick={() => {
              setNodeModalType(option.type);
              setIsNodeModalOpen(true);
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

  if (mode === 'hall') {
    return (
      <div className="app-container hall-screen">
        <section className="hall-shell">
          <header className="hall-header">
            <div>
              <p className="eyebrow">Hall inicial</p>
              <h1>Fluxogramas</h1>
              <p className="hall-subtitle">
                Crie, edite e remova os fluxogramas aqui. Clique em um painel para abrir o canvas infinito.
              </p>
            </div>

            <button type="button" className="btn-primary" onClick={openHallCreate}>
              + Novo painel
            </button>
          </header>

          <div className="hall-grid">
            {visoes.length === 0 ? (
              <div className="empty-hall">
                <div className="empty-hall-icon">📦</div>
                <strong>Nenhum fluxograma criado ainda</strong>
                <p>Comece criando o primeiro painel para abrir o canvas depois.</p>
                <button type="button" className="btn-primary" onClick={openHallCreate}>
                  Criar painel
                </button>
              </div>
            ) : (
              visoes.map((visao) => (
                <HallCard
                  key={visao.id}
                  visao={visao}
                  onOpen={openCanvas}
                  onEdit={openHallEdit}
                  onDelete={handleDeleteVisao}
                />
              ))
            )}
          </div>
        </section>

        <HallModal
          open={isHallModalOpen}
          title={hallModalMode === 'create' ? 'Novo fluxograma' : 'Editar fluxograma'}
          description={
            hallModalMode === 'create'
              ? 'Dê um nome ao novo painel do hall.'
              : 'Atualize o nome do fluxograma selecionado.'
          }
          initialValue={editingVisao?.nome ?? ''}
          submitLabel={hallModalMode === 'create' ? 'Criar painel' : 'Salvar alterações'}
          onClose={() => setIsHallModalOpen(false)}
          onSubmit={handleHallSubmit}
        />
      </div>
    );
  }

  return (
    <div className="app-container canvas-screen">
      <button type="button" className="exit-button" onClick={closeCanvas}>
        Sair
      </button>

      {toolbar}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#2a2f3b" gap={20} size={1} />
      </ReactFlow>

      <NodeModal
        open={isNodeModalOpen}
        initialType={nodeModalType}
        onClose={() => setIsNodeModalOpen(false)}
        onSubmit={handleCreateNode}
      />
    </div>
  );
}
