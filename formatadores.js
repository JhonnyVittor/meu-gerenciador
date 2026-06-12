export function aplicarMascaraMoeda(e) {
    let valor = e.target.value.replace(/\D/g, ""); 
    valor = (valor / 100).toFixed(2) + ""; 
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1."); 
    e.target.value = valor ? "R$ " + valor : "";
}

export function formatarStringParaFloat(texto) {
    if (!texto) return 0;
    let limpo = texto.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
    return parseFloat(limpo) || 0;
}

export function formatarFloatParaReal(valor) {
    return valor.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
}