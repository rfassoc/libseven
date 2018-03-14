(() => {
  const tt = document.getElementById('tooltip');
  for (const elem of document.getElementsByClassName('tt')) {
    (text => {
      elem.onmouseenter = () => {
        const bb = elem.getBoundingClientRect();
        tt.style.bottom = `${document.documentElement.clientHeight - bb.top + 10}px`;
        tt.style.right = `${document.documentElement.clientWidth - bb.right + bb.width / 2}px`;
        tt.innerText = text;
        tt.classList.add('show');
      };
      elem.onmouseleave = () => tt.classList.remove('show');
    })(elem.getAttribute('data-tt'));
  }
})();