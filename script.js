import { db } from "./firebase-config.js";
import { doc, setDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { aplicarMascaraMoeda, formatarStringParaFloat, formatarFloatParaReal } from "./formatadores.js";

// ==========================================
// CONTROLE DE DATAS E MESES
// ==========================================
const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
let dataAtiva = new Date();

const seletorMes = document.getElementById('seletor-mes');
const btnMesAnterior = document.getElementById('btn-mes-anterior');
const btnMesProximo = document.getElementById('btn-mes-proximo');
const listaHistorico = document.getElementById('lista-historico-meses');

function inicializarSeletorMeses() {
    seletorMes.innerHTML = '';
    const anoAtual = dataAtiva.getFullYear();
    const mesAtualIndex = dataAtiva.getMonth();

    for (let i = 0; i < 12; i++) {
        const opt = document.createElement('option');
        opt.value = `${anoAtual}-${String(i + 1).padStart(2, '0')}`;
        opt.textContent = `${nomesMeses[i]} / ${anoAtual}`;
        if (i === mesAtualIndex) opt.selected = true;
        seletorMes.appendChild(opt);
    }
}

function getMesChave() {
    return seletorMes.value || `${dataAtiva.getFullYear()}-${String(dataAtiva.getMonth() + 1).padStart(2, '0')}`;
}

// ==========================================
// ELEMENTOS DA INTERFACE E ESTADOS
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
let unsubscribeConexao = null;

// Ativa as máscaras nos inputs
document.querySelectorAll('.mascara-moeda').forEach(input => {
    input.addEventListener('input', aplicarMascaraMoeda);
});

// ==========================================
// RENDERIZAÇÃO DO PAINEL
// ==========================================
function atualizarDashboard() {
    listaContas.innerHTML = '';
    listaReceitas.innerHTML = '';
    
    let baseSalarios = (parseFloat(salarios.s1) || 0) + (parseFloat(salarios.s2) || 0);
    let totalExtras = 0;
    let totalPendente = 0;
    let totalPago = 0;

    receitasExtras.forEach((extra, index) => {
    totalExtras += extra.valor;
    const li = document.createElement('li');
    li.className = 'conta-item';
    li.innerHTML = `
        <div class="conta-info">
            <strong>${extra.nome}</strong>
            <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">
                ${extra.categoria || 'Sem categoria'}
            </span>
            <span style="color: #10b981">+ R$ ${formatarFloatParaReal(extra.valor)}</span>
        </div>
        <div class="acoes">
            <button class="btn-remover" onclick="removerReceitaExtra(${index})">X</button>
        </div>
    `;
    listaReceitas.appendChild(li);
});

    let receitaTotal = baseSalarios + totalExtras;

    contas.forEach((conta, index) => {
        conta.paga ? totalPago += conta.valor : totalPendente += conta.valor;
        const li = document.createElement('li');
        li.className = `conta-item ${conta.paga ? 'paga' : ''}`;
        const txtVencimento = conta.vencimento ? `<span class="badge-vencimento">Vence dia ${conta.vencimento}</span>` : '';

        li.innerHTML = `
            <div class="conta-info"><strong>${conta.nome} ${txtVencimento}</strong><span>R$ ${formatarFloatParaReal(conta.valor)}</span></div>
            <div class="acoes">
                <button class="btn-status" onclick="alternarStatusConta(${index})">${conta.paga ? '✓ Pago' : 'Pagar'}</button>
                <button class="btn-remover" onclick="removerConta(${index})">X</button>
            </div>
        `;
        listaContas.appendChild(li);
    });

    let saldoRestante = receitaTotal - (totalPendente + totalPago);
    cardReceita.textContent = formatarFloatParaReal(receitaTotal);
    cardPendente.textContent = formatarFloatParaReal(totalPendente);
    cardPago.textContent = formatarFloatParaReal(totalPago);
    cardSaldo.textContent = formatarFloatParaReal(saldoRestante);

    const boxSaldo = document.querySelector('.card-saldo');
    if (boxSaldo) {
        saldoRestante < 0 ? boxSaldo.classList.add('negativo') : boxSaldo.classList.remove('negativo');
    }

    atualizarGrafico(saldoRestante, totalPendente, totalPago);
    salvarResumoNoHistorico(receitaTotal, (totalPendente + totalPago), saldoRestante);
}

// ==========================================
// BANCO DE DADOS (FIREBASE)
// ==========================================
async function salvarNoFirebase() {
    try {
        await setDoc(doc(db, "financas", getMesChave()), { salarios, receitasExtras, contas });
    } catch (error) {
        console.error("Erro ao salvar no Firebase:", error);
    }
}

async function salvarResumoNoHistorico(renda, gastos, sobrou) {
    const mesChave = getMesChave();
    const histRef = doc(db, "historico_consolidado", "geral");
    try {
        const snap = await getDoc(histRef);
        let dadosGerais = snap.exists() ? snap.data() : {};
        dadosGerais[mesChave] = {
            rotulo: seletorMes.options[seletorMes.selectedIndex]?.text || mesChave,
            renda, gastos, sobrou
        };
        await setDoc(histRef, dadosGerais);
    } catch (e) {
        console.error("Erro ao salvar resumo:", e);
    }
}

function conectarMesAtivo() {
    if (unsubscribeConexao) unsubscribeConexao();

    unsubscribeConexao = onSnapshot(doc(db, "financas", getMesChave()), async (snapshot) => {
        if (snapshot.exists()) {
            const dados = snapshot.data();
            salarios = dados.salarios || { s1: 0, s2: 0 };
            receitasExtras = dados.receitasExtras || [];
            contas = dados.contas || [];
            
            if (document.activeElement !== inputSalario1) inputSalario1.value = salarios.s1 ? "R$ " + formatarFloatParaReal(salarios.s1) : '';
            if (document.activeElement !== inputSalario2) inputSalario2.value = salarios.s2 ? "R$ " + formatarFloatParaReal(salarios.s2) : '';
            
            atualizarDashboard();
        } else {
            salarios = await buscarUltimosSalarios();
            receitasExtras = []; contas = [];
            salvarNoFirebase();
        }
    });
}

async function buscarUltimosSalarios() {
    const snapHist = await getDoc(doc(db, "historico_consolidado", "geral"));
    if (snapHist.exists()) {
        const chaves = Object.keys(snapHist.data()).sort();
        if (chaves.length > 0) {
            const ultimoDoc = await getDoc(doc(db, "financas", chaves[chaves.length - 1]));
            if (ultimoDoc.exists() && ultimoDoc.data().salarios) return ultimoDoc.data().salarios;
        }
    }
    return { s1: 0, s2: 0 };
}

function conectarHistoricoGeral() {
    const histRef = doc(db, "historico_consolidado", "geral");
    onSnapshot(histRef, (snapshot) => {
        // Proteção: verifica se o elemento realmente existe na tela antes de mexer
        if (!listaHistorico) return; 
        
        listaHistorico.innerHTML = '';
        if (snapshot.exists()) {
            const dados = snapshot.data();
            const chavesOrdenadas = Object.keys(dados).sort();
            if (chavesOrdenadas.length === 0) {
                listaHistorico.innerHTML = '<li class="conta-item vazio">Nenhum histórico salvo ainda.</li>';
                return;
            }
            chavesOrdenadas.forEach(chave => {
                const mesData = dados[chave];
                const li = document.createElement('li');
                li.className = 'conta-item';
                const classeSaldo = mesData.sobrou >= 0 ? 'item-positivo' : 'item-negativo';
                li.innerHTML = `
                    <div class="conta-info"><strong>${mesData.rotulo}</strong>
                        <div class="historico-valores"><span>Renda: <strong>R$ ${formatarFloatParaReal(mesData.renda)}</strong></span><span>Gastos: <strong>R$ ${formatarFloatParaReal(mesData.gastos)}</strong></span></div>
                    </div>
                    <div class="acoes"><span class="${classeSaldo}">R$ ${formatarFloatParaReal(mesData.sobrou)}</span></div>
                `;
                listaHistorico.appendChild(li);
            });
        } else {
            listaHistorico.innerHTML = '<li class="conta-item vazio">Nenhum histórico salvo ainda.</li>';
        }
    });
}

// ==========================================
// GRÁFICOS (CHART.JS)
// ==========================================
function atualizarGrafico(saldo, pendente, pago) {
    const ctx = document.getElementById('graficoFinancas');
    if (!ctx) return;
    const dadosSaldo = saldo < 0 ? 0 : saldo;

    if (meuGrafico) {
        meuGrafico.data.datasets[0].data = [dadosSaldo, pendente, pago];
        meuGrafico.update();
    } else if (typeof Chart !== 'undefined') {
        // @ts-ignore
        meuGrafico = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Saldo Disponível', 'Contas Pendentes', 'Contas Pagas'],
                datasets: [{ data: [dadosSaldo, pendente, pago], backgroundColor: ['#06b6d4', '#f59e0b', '#6366f1'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

// ==========================================
// INICIALIZAÇÃO SEGURA (ESPERA O HTML)
// ==========================================
function inicializarTudo() {
    inicializarSeletorMeses();
    conectarMesAtivo();
    conectarHistoricoGeral();

    seletorMes.addEventListener('change', conectarMesAtivo);
    btnMesAnterior.addEventListener('click', () => { if (seletorMes.selectedIndex > 0) { seletorMes.selectedIndex--; conectarMesAtivo(); } });
    btnMesProximo.addEventListener('click', () => { if (seletorMes.selectedIndex < seletorMes.options.length - 1) { seletorMes.selectedIndex++; conectarMesAtivo(); } });

    btnSalvarSalarios.addEventListener('click', () => {
        salarios.s1 = formatarStringParaFloat(inputSalario1.value);
        salarios.s2 = formatarStringParaFloat(inputSalario2.value);
        salvarNoFirebase();
        alert('Salários fixos atualizados para este mês!');
    });

    formReceita.addEventListener('submit', (e) => {
        e.preventDefault();
        receitasExtras.push({ nome: receitaNomeInput.value, valor: formatarStringParaFloat(receitaValorInput.value) });
        salvarNoFirebase();
        receitaNomeInput.value = ''; receitaValorInput.value = ''; receitaNomeInput.focus();
    });

    formConta.addEventListener('submit', (e) => {
    e.preventDefault();
    const categoriaInput = document.getElementById('categoria'); // Captura o select
    contas.push({ 
        nome: nomeInput.value, 
        vencimento: document.getElementById('vencimento').value, 
        valor: formatarStringParaFloat(valorInput.value), 
        categoria: categoriaInput.value, // Salva a categoria
        paga: false 
    });
    salvarNoFirebase();
    nomeInput.value = ''; 
    valorInput.value = ''; 
    nomeInput.focus();
});
}

// Executa o inicializador assim que o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarTudo);
} else {
    inicializarTudo();
}

window.alternarStatusConta = index => { contas[index].paga = !contas[index].paga; salvarNoFirebase(); };
window.removerConta = index => { if (confirm('Deseja apagar esta conta?')) { contas.splice(index, 1); salvarNoFirebase(); } };
window.removerReceitaExtra = index => { if (confirm('Deseja apagar esta receita extra?')) { receitasExtras.splice(index, 1); salvarNoFirebase(); } };