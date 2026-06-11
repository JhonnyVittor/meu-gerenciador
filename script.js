import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. CONFIGURAÇÃO REAL DO SEU FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDWBe_sX4GSes9RyvMRDUjw0O5U75z7ArE",
    authDomain: "meu-gerenciador-225eb.firebaseapp.com",
    projectId: "meu-gerenciador-225eb",
    storageBucket: "meu-gerenciador-225eb.firebasestorage.app",
    messagingSenderId: "493667661568",
    appId: "1:493667661568:web:7634c39a36af27026da5e5",
    measurementId: "G-VPMLFYV95X"
};

// Inicializando o Firebase e o Banco de Dados
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Documento único onde guardaremos os dados da família (Documento "dados" na coleção "financas")
const docRef = doc(db, "financas", "dados");

// ==========================================
// 2. ELEMENTOS DA INTERFACE
// ==========================================
const formConta = document.getElementById('form-conta');
const nomeInput = document.getElementById('nome');
const valorInput = document.getElementById('valor');
const listaContas = document.getElementById('lista-contas');

const formReceita = document.getElementById('form-receita');
const receitaNomeInput = document.getElementById('receita-nome');
const receitaValorInput = document.getElementById('receita-valor');
const listaReceitas = document.getElementById('lista-receitas');

const inputSalario1 = document.getElementById('salario-1');
const inputSalario2 = document.getElementById('salario-2');
const btnSalvarSalarios = document.getElementById('btn-salvar-salarios');

const cardReceita = document.getElementById('total-receita');
const cardPendente = document.getElementById('total-pendente');
const cardPago = document.getElementById('total-pago');
const cardSaldo = document.getElementById('total-saldo');

let contas = [];
let receitasExtras = [];
let salarios = { s1: 0, s2: 0 };
let meuGrafico = null;

// ==========================================
// 3. MÁSCARAS E FORMATAÇÕES
// ==========================================
function aplicarMascaraMoeda(e) {
    let valor = e.target.value.replace(/\D/g, ""); 
    valor = (valor / 100).toFixed(2) + ""; 
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1."); 
    e.target.value = valor ? "R$ " + valor : "";
}

function formatarStringParaFloat(texto) {
    if (!texto) return 0;
    let limpo = texto.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
    return parseFloat(limpo) || 0;
}

function formatarFloatParaReal(valor) {
    return valor.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
}

document.querySelectorAll('.mascara-moeda').forEach(input => {
    input.addEventListener('input', aplicarMascaraMoeda);
});

// ==========================================
// 4. LÓGICA DO GRÁFICO (CHART.JS)
// ==========================================
function inicializarGrafico(saldo, pendente, pago) {
    const ctx = document.getElementById('graficoFinancas').getContext('2d');
    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Saldo Disponível', 'Contas Pendentes', 'Contas Pagas'],
            datasets: [{
                data: [saldo, pendente, pago],
                backgroundColor: ['#06b6d4', '#f59e0b', '#6366f1'],
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { color: '#f8fafc', font: { size: 12 } } } }
        }
    });
}

function atualizarGrafico(saldo, pendente, pago) {
    const saldoSeguro = saldo < 0 ? 0 : saldo;
    if (meuGrafico) {
        meuGrafico.data.datasets[0].data = [saldoSeguro, pendente, pago];
        meuGrafico.update();
    } else {
        inicializarGrafico(saldoSeguro, pendente, pago);
    }
}

// ==========================================
// 5. ATUALIZAR INTERFACE E CALCULAR TOTAIS
// ==========================================
function atualizarDashboard() {
    listaContas.innerHTML = '';
    listaReceitas.innerHTML = '';
    
    let baseSalarios = (parseFloat(salarios.s1) || 0) + (parseFloat(salarios.s2) || 0);
    let totalExtras = 0;
    let totalPendente = 0;
    let totalPago = 0;

    // Renderizar Extras
    receitasExtras.forEach((extra, index) => {
        totalExtras += extra.valor;
        const li = document.createElement('li');
        li.className = 'conta-item';
        li.innerHTML = `
            <div class="conta-info">
                <strong>${extra.nome}</strong>
                <span style="color: var(--success)">+ R$ ${formatarFloatParaReal(extra.valor)}</span>
            </div>
            <div class="acoes">
                <button class="btn-remover" onclick="removerReceitaExtra(${index})">X</button>
            </div>
        `;
        listaReceitas.appendChild(li);
    });

    let receitaTotal = baseSalarios + totalExtras;

    // Renderizar Contas
    contas.forEach((conta, index) => {
        if (conta.paga) {
            totalPago += conta.valor;
        } else {
            totalPendente += conta.valor;
        }

        const li = document.createElement('li');
        li.className = `conta-item ${conta.paga ? 'paga' : ''}`;
        li.innerHTML = `
            <div class="conta-info">
                <strong>${conta.nome}</strong>
                <span>R$ ${formatarFloatParaReal(conta.valor)}</span>
            </div>
            <div class="acoes">
                <button class="btn-status" onclick="alternarStatusConta(${index})">
                    ${conta.paga ? '✓ Pago' : 'Pagar'}
                </button>
                <button class="btn-remover" onclick="removerConta(${index})">X</button>
            </div>
        `;
        listaContas.appendChild(li);
    });

    let saldoRestante = receitaTotal - (totalPendente + totalPago);

    // Atualizar Cards
    cardReceita.textContent = formatarFloatParaReal(receitaTotal);
    cardPendente.textContent = formatarFloatParaReal(totalPendente);
    cardPago.textContent = formatarFloatParaReal(totalPago);
    cardSaldo.textContent = formatarFloatParaReal(saldoRestante);

    if (saldoRestante < 0) {
        cardSaldo.parentElement.classList.add('negativo');
    } else {
        cardSaldo.parentElement.classList.remove('negativo');
    }

    atualizarGrafico(saldoRestante, totalPendente, totalPago);
}

// ==========================================
// 6. PERSISTÊNCIA NO BANCO DE DADOS (FIREBASE)
// ==========================================
async function salvarNoFirebase() {
    try {
        await setDoc(docRef, {
            salarios: salarios,
            receitasExtras: receitasExtras,
            contas: contas
        });
    } catch (error) {
        console.error("Erro ao salvar no Firebase:", error);
    }
}

// Sincronização em tempo real
onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
        const dados = snapshot.data();
        salarios = dados.salarios || { s1: 0, s2: 0 };
        receitasExtras = dados.receitasExtras || [];
        contas = dados.contas || [];
        
        if (document.activeElement !== inputSalario1) {
            inputSalario1.value = salarios.s1 ? "R$ " + formatarFloatParaReal(salarios.s1) : '';
        }
        if (document.activeElement !== inputSalario2) {
            inputSalario2.value = salarios.s2 ? "R$ " + formatarFloatParaReal(salarios.s2) : '';
        }
        
        atualizarDashboard();
    } else {
        salvarNoFirebase();
    }
});

// ==========================================
// 7. EVENTOS DE INTERAÇÃO
// ==========================================
btnSalvarSalarios.addEventListener('click', () => {
    salarios.s1 = formatarStringParaFloat(inputSalario1.value);
    salarios.s2 = formatarStringParaFloat(inputSalario2.value);
    salvarNoFirebase();
    alert('Salários fixos atualizados na nuvem!');
});

formReceita.addEventListener('submit', (e) => {
    e.preventDefault();
    const novaReceita = {
        nome: receitaNomeInput.value,
        valor: formatarStringParaFloat(receitaValorInput.value)
    };
    receitasExtras.push(novaReceita);
    salvarNoFirebase();
    receitaNomeInput.value = '';
    receitaValorInput.value = '';
    receitaNomeInput.focus();
});

formConta.addEventListener('submit', (e) => {
    e.preventDefault();
    const novaConta = {
        nome: nomeInput.value,
        valor: formatarStringParaFloat(valorInput.value),
        paga: false
    };
    contas.push(novaConta);
    salvarNoFirebase();
    nomeInput.value = '';
    valorInput.value = '';
    nomeInput.focus();
});

window.alternarStatusConta = function(index) {
    contas[index].paga = !contas[index].paga;
    salvarNoFirebase();
};

window.removerConta = function(index) {
    if (confirm('Deseja apagar esta conta?')) {
        contas.splice(index, 1);
        salvarNoFirebase();
    }
};

window.removerReceitaExtra = function(index) {
    if (confirm('Deseja apagar esta receita extra?')) {
        receitasExtras.splice(index, 1);
        salvarNoFirebase();
    }
};