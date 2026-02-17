export function cellTransformer(value,rule){
    switch(rule.type){
        case 'toUpper': return value.toUpperCase();
        case 'toLower': return value.toLowerCase();
        case 'trim': return value.trim();
        case 'replaceNull': return rule.options.replacement;
        case 'replaceAll': return value.replaceAll(rule.options.substr,rule.options.replacement);
        default:{
            console.warn('unknown transformation',rule.type);
            return value;
        }
    }
}