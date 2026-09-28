const norm = (s) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]/g, '');

function levenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () => []);
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[a.length][b.length];
}

function benzerlikSkoru(a, b) {
    const na = norm(a), nb = norm(b);
    if (!na || !nb) return 0;
    if (na === nb) return 100;

    const distance = levenshtein(na, nb);
    const maxLen = Math.max(na.length, nb.length);
    let score = (1 - (distance / maxLen)) * 100;

    if (na.includes(nb) || nb.includes(na)) {
        const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
        let base = 20;
        if (ratio >= 0.6) base = 60;
        else if (ratio >= 0.4) base = 40;
        
        score = Math.max(score, base + ratio * 40);
    }
    
    return Math.round(score);
}
