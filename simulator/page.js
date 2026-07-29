// Page de suivi du simulateur : boutons de panne + jobs décodés, poussés en SSE.
const BASCULES = {
  horsLigne: 'Hors ligne',
  papier: 'Fin de papier',
  ruban: 'Fin de ruban',
  tete: 'Tête ouverte',
  pause: 'Pause',
}
let etat = {}

function rendreBoutons() {
  const boutons = Object.entries(BASCULES).map(([cle, libelle]) => {
    const btn = document.createElement('button')
    btn.textContent = libelle
    btn.className = etat[cle] ? 'actif' : ''
    btn.onclick = () =>
      fetch('/etat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [cle]: !etat[cle] }),
      })
    return btn
  })
  document.getElementById('boutons').replaceChildren(...boutons)
}

function carteJob(j) {
  const carte = document.createElement('div')
  carte.className = 'job'
  if (j.image) {
    const img = document.createElement('img')
    img.src = j.image
    carte.appendChild(img)
  }
  const meta = document.createElement('div')
  meta.className = 'meta'
  const quantite = document.createElement('div')
  quantite.append('Quantité : ')
  const gras = document.createElement('b')
  gras.textContent = String(j.quantite)
  quantite.appendChild(gras)
  for (const ligne of [
    j.date,
    quantite,
    `${j.largeurPx} × ${j.hauteurPx} px`,
    `Contraste ${j.contraste} — vitesse ${j.vitesse} — offsets ${j.offsetX}, ${j.offsetY}`,
  ]) {
    if (ligne instanceof HTMLElement) {
      meta.appendChild(ligne)
    } else {
      const div = document.createElement('div')
      div.textContent = ligne
      meta.appendChild(div)
    }
  }
  carte.appendChild(meta)
  return carte
}

new EventSource('/events').onmessage = (e) => {
  const d = JSON.parse(e.data)
  etat = d.etat
  rendreBoutons()
  if (d.jobs.length) document.getElementById('jobs').replaceChildren(...d.jobs.map(carteJob))
}
