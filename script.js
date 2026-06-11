import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. CONFIGURAÇÃO DO SEU FIREBASE
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// 2. CONTROLE DE DATAS E MESES
// ==========================================
const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
let dataAtiva = new Date(); // Começa no mês atual

const seletorMes = document.getElementById('seletor-mes');
const btnMesAnterior = document.getElementById('btn-mes-anterior');
const btnMesProximo = document.getElementById('btn-mes-proximo');
const listaHistorico = document.getElementById('lista-historico-meses');

// Preenche o seletor HTML com uma janela de meses (6 meses antes e 6 depois)
function inicializarSeletorMeses() {
    seletorMes.innerHTML = '';
    const anoAtual = dataAtiva.getFullYear();
    const mesAtualIndex = dataAtiva.getMonth();

    // Vamos gerar opções para o ano vigente
    for (let i = 0; i < 12; i++) {
        const opt = document.createElement('option');
        // Valor guardado no Firebase ex: "2026-06"
        const stringMes = `${anoAtual}-${String(i + 1).padStart(2, '0')}`;
        opt.value = stringMes;
        opt.textContent = `${nomesMeses[i]} / ${anoAtual}`;
        
        if (i === mesAtualIndex) {
            opt.selected = true;
        }
        seletorMes.appendChild(opt);
    }
}

// Retorna o ID do documento ativo (ex: "2026-06")
function getMesChave() {
    return seletorMes.value || `${dataAtiva.getFullYear()}-${String(dataAtiva.getMonth() + 1).padStart(2, '0')}`;
}

// ==========================================
// 3. ELEMENTOS DA INTERFACE (FINANÇAS)
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
let unsubscribeConexao = null; // Guarda o evento de escuta em tempo real

// ==========================================
// 4. MÁSCARAS E FORMATAÇÕES
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
// 5. LÓGICA DO GRÁFICO
// ==========================================
function atualizarGrafico(saldo, pendente, pago) {
    const saldoSeguro = saldo < 0 ? 0 : saldo;
    const ctx = document.getElementById('graficoFinancas').getContext('2d');
    
    if (meuGrafico) {
        meuGrafico.data.datasets[0].data = [saldoSeguro, pendente, pago];
        meuGrafico.update();
    } else {
        meuGrafico = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Saldo Disponível', 'Contas Pendentes', 'Contas Pagas'],
                datasets: [{
                    data: [saldoSeguro, pendente, pago],
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
}

// ==========================================
// 6. ATUALIZAÇÃO DO DASHBOARD E HISTÓRICO
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
    
    // Atualiza o resumo consolidado deste mês na tabela global de histórico
    salvarResumoNoHistorico(receitaTotal, (totalPendente + totalPago), saldoRestante);
}

// ==========================================
// 7. PERSISTÊNCIA E SINCRONIZAÇÃO (FIREBASE)
// ==========================================
async function salvarNoFirebase() {
    const mesChave = getMesChave();
    const docRef = doc(db, "financas", mesChave);
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

// Salva de forma simplificada os totais do mês para renderizar o bloco de histórico rápido
async function salvarResumoNoHistorico(renda, gastos, sobrou) {
    const mesChave = getMesChave();
    const histRef = doc(db, "historico_consolidado", "geral");
    
    try {
        const snap = await getDoc(histRef);
        let dadosGerais = snap.exists() ? snap.data() : {};
        
        dadosGerais[mesChave] = {
            rotulo: seletorMes.options[seletorMes.selectedIndex]?.text || mesChave,
            renda: renda,
            gastos: gastos,
            sobrou: sobrou
        };
        
        await setDoc(histRef, dadosGerais);
    } catch (e) {
        console.error("Erro ao salvar resumo consolidado:", e);
    }
}

// Conecta e escuta o mês selecionado em tempo real
function conectarMesAtivo() {
    // Se já havia uma conexão aberta de outro mês, fecha ela antes
    if (unsubscribeConexao) unsubscribeConexao();

    const mesChave = getMesChave();
    const docRef = doc(db, "financas", mesChave);

    unsubscribeConexao = onSnapshot(docRef, async (snapshot) => {
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
            // Se o mês for completamente novo, tentamos herdar os salários salvos do último mês configurado para poupar digitação
            const salariosHerdados = await buscarUltimosSalarios();
            salarios = salariosHerdados;
            receitasExtras = [];
            contas = [];
            salvarNoFirebase();
        }
    });
}

// Função inteligente para não precisar redigitar os salários todo mês
async function buscarUltimosSalarios() {
    const histRef = doc(db, "historico_consolidado", "geral");
    const snapHist = await getDoc(histRef);
    if (snapHist.exists()) {
        const chaves = Object.keys(snapHist.data()).sort();
        if (chaves.length > 0) {
            const ultimaChave = chaves[chaves.length - 1];
            const ultimoDoc = await getDoc(doc(db, "financas", ultimaChave));
            if (ultimoDoc.exists() && ultimoDoc.data().salarios) {
                return ultimoDoc.data().salarios;
            }
        }
    }
    return { s1: 0, s2: 0 };
}

// Escuta a lista completa de históricos de meses anteriores
function conectarHistoricoGeral() {
    const histRef = doc(db, "historico_consolidado", "geral");
    onSnapshot(histRef, (snapshot) => {
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
                    <div class="conta-info">
                        <strong>${mesData.rotulo}</strong>
                        <div class="historico-valores">
                            <span>Renda: <strong>R$ ${formatarFloatParaReal(mesData.renda)}</strong></span>
                            <span>Gastos: <strong>R$ ${formatarFloatParaReal(mesData.gastos)}</strong></span>
                        </div>
                    </div>
                    <div class="acoes">
                        <span class="${classeSaldo}">R$ ${formatarFloatParaReal(mesData.sobrou)}</span>
                    </div>
                `;
                listaHistorico.appendChild(li);
            });
        } else {
            listaHistorico.innerHTML = '<li class="conta-item vazio">Nenhum histórico salvo ainda.</li>';
        }
    });
}

// ==========================================
// 8. EVENTOS DE INTERAÇÃO E INICIALIZAÇÃO
// ==========================================
inicializarSeletorMeses();
conectarMesAtivo();
conectarHistoricoGeral();

seletorMes.addEventListener('change', () => {
    conectarMesAtivo();
});

btnMesAnterior.addEventListener('click', () => {
    let index = seletorMes.selectedIndex;
    if (index > 0) {
        seletorMes.selectedIndex = index - 1;
        conectarMesAtivo();
    }
});

btnMesProximo.addEventListener('click', () => {
    let index = seletorMes.selectedIndex;
    if (index < seletorMes.options.length - 1) {
        seletorMes.selectedIndex = index + 1;
        conectarMesAtivo();
    }
});

btnSalvarSalarios.addEventListener('click', () => {
    salarios.s1 = formatarStringParaFloat(inputSalario1.value);
    salarios.s2 = formatarStringParaFloat(inputSalario2.value);
    salvarNoFirebase();
    alert('Salários fixos atualizados para este mês!');
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