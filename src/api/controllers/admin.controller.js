const adminService = require('../../services/admin.service');

function safeEvaluate(formula) {
    if (typeof formula !== 'string' || formula.trim() === '') {
        throw new Error('Invalid formula');
    }

    const tokens = [];
    let i = 0;
    const str = formula.trim();

    while (i < str.length) {
        const char = str[i];
        if (/\s/.test(char)) {
            i++;
            continue;
        }
        if (/[0-9.]/.test(char)) {
            let numStr = '';
            let dotCount = 0;
            while (i < str.length && /[0-9.]/.test(str[i])) {
                if (str[i] === '.') {
                    dotCount++;
                    if (dotCount > 1) throw new Error('Invalid number');
                }
                numStr += str[i];
                i++;
            }
            if (numStr === '.') throw new Error('Invalid number');
            tokens.push({ type: 'number', value: parseFloat(numStr) });
            continue;
        }
        if ('+-*/%()'.includes(char)) {
            tokens.push({ type: char, value: char });
            i++;
            continue;
        }
        throw new Error(`Unexpected character: ${char}`);
    }

    if (tokens.length === 0) {
        throw new Error('Empty expression');
    }

    let pos = 0;

    function peek() {
        return tokens[pos];
    }

    function consume(type) {
        const token = tokens[pos];
        if (!token || (type && token.type !== type)) {
            throw new Error(`Expected token ${type}`);
        }
        pos++;
        return token;
    }

    function parseExpression() {
        let val = parseTerm();
        while (peek() && (peek().type === '+' || peek().type === '-')) {
            const op = consume().type;
            const right = parseTerm();
            if (op === '+') val += right;
            else if (op === '-') val -= right;
        }
        return val;
    }

    function parseTerm() {
        let val = parseFactor();
        while (peek() && (peek().type === '*' || peek().type === '/' || peek().type === '%')) {
            const op = consume().type;
            const right = parseFactor();
            if (op === '*') val *= right;
            else if (op === '/') {
                if (right === 0) throw new Error('Division by zero');
                val /= right;
            }
            else if (op === '%') {
                if (right === 0) throw new Error('Modulo by zero');
                val %= right;
            }
        }
        return val;
    }

    function parseFactor() {
        const token = peek();
        if (!token) throw new Error('Unexpected end of input');

        if (token.type === '+') {
            consume('+');
            return parseFactor();
        }
        if (token.type === '-') {
            consume('-');
            return -parseFactor();
        }
        if (token.type === 'number') {
            consume('number');
            return token.value;
        }
        if (token.type === '(') {
            consume('(');
            const val = parseExpression();
            consume(')');
            return val;
        }
        throw new Error(`Unexpected token: ${token.type}`);
    }

    const result = parseExpression();
    if (pos < tokens.length) {
        throw new Error('Unexpected extra tokens');
    }
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        throw new Error('Invalid calculation result');
    }
    return result;
}

exports.checkShippingStatus = (req, res) => {
    adminService.pingProvider(req.body.providerIP, req.body.options, out => res.send(out));
};

exports.previewDynamicPricing = (req, res) => {
    try {
        res.json({ price: safeEvaluate(req.body.formula) });
    } catch (e) {
        res.status(400).send("Evaluation Failed");
    }
};
