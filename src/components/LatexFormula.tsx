import { useMemo } from 'react';
import katex from 'katex';

interface Props {
  formula: string;
  displayMode?: boolean;
}

export default function LatexFormula({ formula, displayMode = false }: Props) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(formula, {
        throwOnError: false,
        displayMode,
        output: 'html',
        leqno: false,
        fleqn: false,
      });
    } catch {
      return formula;
    }
  }, [formula, displayMode]);

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
