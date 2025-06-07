/** @format */

export const sortImportsByLength = {
  meta: {
    type: "suggestion",
    docs: {
      description: "enforce sorting import statements by length and separate type imports",
      category: "Stylistic Issues",
      recommended: false
    },
    fixable: "code",
    schema: []
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    return {
      Program(node) {
        const importNodes = node.body.filter((n) => n.type === "ImportDeclaration");

        if (importNodes.length < 2) return;

        const typeImports = [];
        const normalImports = [];

        for (const imp of importNodes)
          if (imp.importKind === "type") typeImports.push(imp);
          else normalImports.push(imp);

        const sortByLength = (a, b) => {
          const textA = sourceCode.getText(a);
          const textB = sourceCode.getText(b);
          return textA.length - textB.length;
        };

        const sortedType = typeImports.slice().sort(sortByLength);
        const sortedNormal = normalImports.slice().sort(sortByLength);

        const typeText = sortedType.map((n) => sourceCode.getText(n)).join("\n");
        const normalText = sortedNormal.map((n) => sourceCode.getText(n)).join("\n");

        const expectedText = typeImports.length ? `${normalText.trim()}\n\n${typeText.trim()}` : normalText.trim();

        const firstImport = importNodes[0];
        const lastImport = importNodes[importNodes.length - 1];
        const actualText = sourceCode.text.slice(firstImport.range[0], lastImport.range[1]).trim();

        if (actualText.trim() !== expectedText.trim()) {
          context.report({
            node: firstImport,
            message:
              "Import declarations are not sorted by length or type imports are not separated correctly." +
              `Expected : \n${expectedText}\n` +
              `Actual   : \n${actualText}`,
            fix(fixer) {
              return fixer.replaceTextRange([firstImport.range[0], lastImport.range[1]], expectedText.trim());
            }
          });
        }
      }
    };
  }
};
