export function normalizeWhitespace(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

export function getElementChildren(node) {
    const children = [];
    let child = node.firstChild;
    while (child) {
        if (child.nodeType === 1) children.push(child);
        child = child.nextSibling;
    }
    return children;
}

export function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
