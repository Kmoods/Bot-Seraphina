const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const PORT = process.env.PORT || 3000; // usa a variável de ambiente ou 3000 para desenvolvimento
app.use(express.json()); // Necessário para ler JSON do corpo da requisição
// Configuração do CORS e JSON
app.use(cors());

app.use(express.static(__dirname));


// Caminho para o arquivo do banco de dados
const dbPath = path.join(__dirname, 'data', 'banco.json');
const historicoSemanalPath = path.join(__dirname, 'data', 'historicoSemanal.json'); // Caminho do arquivo para salvar histórico semanal
const pedidosPath = path.join(__dirname, 'data', 'pedidos.json');
// Banco de dados em memória para os pedidos

// Rota padrão para redirecionar para index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// Rota para obter dados do dashboard (vendas e usuários)
app.get('/api/dados', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(dbPath));
    res.json(data);
  } catch (error) {
    console.error('Erro ao ler dados do banco:', error);
    res.status(500).json({ erro: 'Erro ao ler dados do banco de dados.' });
  }
});

// Rota para excluir um usuário e seus dados associados
app.delete('/api/dados/:numero', (req, res) => {
  const { numero } = req.params;

  try {
    const data = JSON.parse(fs.readFileSync(dbPath));

    // Filtra e remove o usuário
    data.usuarios = data.usuarios.filter(u => u.numero !== numero);

    // Filtra e remove as vendas
    data.vendas = data.vendas.filter(v => v.numero !== numero);

    // Filtra e remove grupos associados ao número (se houver lógica futura)
    data.grupos = data.grupos.filter(g => g.numero !== numero);

    // Atualiza o banco de dados
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao excluir dados:', error);
    res.status(500).json({ erro: 'Erro ao excluir dados.' });
  }
});

// Rota para registrar uma nova venda
app.post('/api/venda', (req, res) => {
  const { numero, valor } = req.body;

  // Validação de dados
  if (!numero || isNaN(valor)) return res.status(400).json({ erro: 'Dados inválidos' });
  if (valor < 13.5) return res.status(400).json({ erro: 'Valor mínimo é R$13,50' });

  try {
    const data = JSON.parse(fs.readFileSync(dbPath)); // Leitura do banco
    const senha = Math.random().toString(36).substring(2, 8); // Geração de senha aleatória
    const dataAtual = new Date().toISOString();

    // Adicionando a nova venda
    data.vendas.push({ numero, valor, senha, data: dataAtual });

    // Adicionando usuário se não existir
    const usuarioIndex = data.usuarios.findIndex(usuario => usuario.numero === numero);
    if (usuarioIndex === -1) {
      data.usuarios.push({ numero, senha, grupos: [] });
    }

    // Escrevendo os dados atualizados no banco
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao registrar venda:', error);
    res.status(500).json({ erro: 'Erro ao registrar venda.' });
  }
});

// Rota para salvar o histórico semanal
app.post('/api/salvarHistoricoSemanal', (req, res) => {
  const { totalSemanaAtual } = req.body;

  if (!totalSemanaAtual || isNaN(totalSemanaAtual)) {
    return res.status(400).json({ erro: 'Dados inválidos para o histórico semanal' });
  }

  try {
    const historicoSemanal = JSON.parse(fs.readFileSync(historicoSemanalPath, 'utf-8') || '[]'); // Lê o histórico ou cria um array vazio

    const dataAtual = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    const historico = {
      data: dataAtual,
      totalSemanaAtual
    };

    // Adiciona o novo histórico ao array
    historicoSemanal.push(historico);

    // Escreve o histórico atualizado no arquivo JSON
    fs.writeFileSync(historicoSemanalPath, JSON.stringify(historicoSemanal, null, 2));

    res.json({ sucesso: true, mensagem: 'Histórico semanal salvo com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar histórico semanal:', error);
    res.status(500).json({ erro: 'Erro ao salvar histórico semanal.' });
  }
});





// Cria o arquivo se não existir
if (!fs.existsSync(pedidosPath)) {
  fs.writeFileSync(pedidosPath, '[]');
}
function lerPedidos() {
  if (!fs.existsSync(pedidosPath)) return [];
  const file = fs.readFileSync(pedidosPath);
  return JSON.parse(file);
}

function salvarPedidos(pedidos) {
  fs.writeFileSync(pedidosPath, JSON.stringify(pedidos, null, 2));
}

app.post('/api/pedido', (req, res) => {
  const { pedido, numero } = req.body;
  if (!pedido || !numero) {
    return res.status(400).json({ erro: 'pedido e numero são obrigatórios' });
  }

  const pedidos = lerPedidos();
  const novoPedido = {
    id: Date.now(),
    pedido,
    numero,
    status: 'pendente',
    notificado: false
  };

  pedidos.push(novoPedido);
  salvarPedidos(pedidos);

  res.status(201).json({ mensagem: 'Pedido salvo com sucesso', pedido: novoPedido });
});

// Endpoint para listar todos os pedidos
app.get('/api/pedidos', (req, res) => {
  const pedidos = lerPedidos();
  res.json(pedidos);
});

// GET /api/respostas – Retorna apenas os aceitos ainda não notificados
app.get('/api/respostas', (req, res) => {
  const pedidos = lerPedidos();
  const aceitosNaoNotificados = pedidos.filter(p => p.status === 'aceito' && !p.notificado);
  res.json(aceitosNaoNotificados);
});

// POST /api/marcarNotificado – Marca pedido como notificado
app.post('/api/marcarNotificado', (req, res) => {
  const { id } = req.body;
  const pedidos = lerPedidos();
  const index = pedidos.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ erro: 'Pedido não encontrado' });

  pedidos[index].notificado = true;
  salvarPedidos(pedidos);
  res.json({ mensagem: 'Pedido marcado como notificado' });
});


app.post('/api/responder', (req, res) => {
  const { id } = req.body;
  const pedidos = lerPedidos();

  const index = pedidos.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ erro: 'Pedido não encontrado' });

  pedidos[index].status = 'aceito';
  salvarPedidos(pedidos);

  res.json({ mensagem: 'Pedido aceito' });
});



// Endpoint para listar arquivos recursivamente
app.get('/api/list-files', (req, res) => {
  const basePath = req.query.path ? path.join(__dirname, req.query.path) : path.join(__dirname, 'public');

  function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(walkDir(filePath));
      } else {
        results.push(path.relative(__dirname, filePath).replace(/\\/g, '/'));
      }
    });
    return results;
  }

  try {
    const files = walkDir(basePath);
    res.json(files);
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    res.status(500).json({ erro: 'Erro ao listar arquivos.' });
  }
});

// Endpoint para ler conteúdo de arquivo
app.get('/api/file-content', (req, res) => {
  const filePath = req.query.path ? path.join(__dirname, req.query.path) : null;
  if (!filePath) {
    return res.status(400).json({ erro: 'Parâmetro path é obrigatório.' });
  }
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ erro: 'Arquivo não encontrado.' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    res.send(content);
  } catch (error) {
    console.error('Erro ao ler arquivo:', error);
    res.status(500).json({ erro: 'Erro ao ler arquivo.' });
  }
});

// Endpoint para salvar conteúdo no arquivo
app.post('/api/save-file', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ erro: 'Parâmetros path e content são obrigatórios.' });
  }
  const fullPath = path.join(__dirname, filePath);
  try {
    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ sucesso: true, message: 'Arquivo salvo com sucesso.' });
  } catch (error) {
    console.error('Erro ao salvar arquivo:', error);
    res.status(500).json({ erro: 'Erro ao salvar arquivo.' });
  }
});
// Iniciando o servidor na porta 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
