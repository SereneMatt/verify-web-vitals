(verify) => {
  const board = document.querySelector('[data-board]');
  const squares = [...board.querySelectorAll('[data-square]')];
  const showing = (index) => {
    const card = squares[index].querySelector('.card');
    const { a } = new DOMMatrix(getComputedStyle(card).transform);
    return a < 0 ? squares[index].querySelector('.back').textContent : 'blank';
  };
  const flipped = () =>
    squares.filter((square) => square.dataset.flipped === 'true').map((square) => `#${square.dataset.square}`);

  verify.onLoad('face down', () => {
    const faces = squares.map((square, index) => showing(index));
    return {
      pass: squares.length === 5 && faces.every((face) => face === 'blank'),
      detail: `${squares.length} squares: ${faces.join(', ')}`
    };
  });
  verify.check('numbers 1–5', () => {
    const numbers = squares.map((square) => square.querySelector('.back').textContent).join(',');
    return { pass: numbers === '1,2,3,4,5', detail: numbers };
  });
  verify.check('fits viewport', () => {
    const { right } = board.getBoundingClientRect();
    const pageWidth = document.documentElement.scrollWidth;
    return {
      pass: pageWidth <= innerWidth && right <= innerWidth,
      detail: `board right ${Math.round(right)}px, page ${pageWidth}px / ${innerWidth}px`
    };
  });

  return async () => {
    verify.step(`${verify.width}px · start`);
    await verify.pause(1200);

    verify.step(`${verify.width}px · hover square #0`);
    await verify.act('hover', '[data-square="0"]');
    await verify.logSettled('#0 shows 1', () => ({ pass: showing(0) === '1', detail: `#0 shows ${showing(0)}` }));
    await verify.pause(1200);

    verify.step(`${verify.width}px · hover square #1`);
    await verify.act('hover', '[data-square="1"]');
    await verify.logSettled('#1 shows 2', () => ({ pass: showing(1) === '2', detail: `#1 shows ${showing(1)}` }));
    await verify.pause(1200);

    verify.step(`${verify.width}px · back onto #0`);
    await verify.act('hover', '[data-square="0"]');
    await verify.logSettled('re-hover flips back', () => ({
      pass: showing(0) === 'blank',
      detail: `#0 shows ${showing(0)}`
    }));
    await verify.logSettled('others unchanged', () => {
      const turned = flipped();
      return { pass: turned.length === 1 && turned[0] === '#1', detail: `flipped: ${turned.join(', ') || 'none'}` };
    });
    await verify.pause(1200);

    verify.step(`${verify.width}px · click Reset`);
    await verify.act('click', '[data-reset]');
    await verify.logSettled('reset', () => ({
      pass: flipped().length === 0,
      detail: `flipped: ${flipped().join(', ') || 'none'}`
    }));
    await verify.pause(1200);
  };
};
