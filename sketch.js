let populationData = null;
let worldGeo = null;

// Niente zoom - solo mappa fissa

// Pannello di dettaglio per spider chart
let selectedCountry = null;
let detailPanel = {
  open: false,
  x: 0,
  y: 0,
  width: 350,
  height: 400,
  closeButton: {x: 0, y: 0, size: 25}
};

// Dropdown per selezione paesi
let countryDropdown = null;
let availableCountries = [];

// Variabili per trascinare la card
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Nomi delle colonne nel CSV
let COLS = {
  country: 'Country (or dependency)',
  population: 'Population 2025',
  yearlyChange: 'Yearly Change',
  netChange: 'Net Change',
  density: 'Density (P/Km²)',
  landArea: 'Land Area (Km²)',
  migrants: 'Migrants (net)',
  fertilityRate: 'Fert. Rate',
  medianAge: 'Median Age',
  urbanPop: 'Urban Pop %',
  worldShare: 'World Share'
};

function preload() {
  // Carica i dati di popolazione con nomi corretti
  populationData = loadTable('population_data_corrected.csv', 'csv', 'header');
  
  // Carica la mappa del mondo filtrata
  worldGeo = loadJSON('countries_filtered.geo.json');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textSize(12);
  textFont('Arial');
  rectMode(CORNER);
  noSmooth(); // bordi netti, non sfumati
}

function draw() {
  background(20);

  // disegna la mappa (senza trasformazioni)
  drawWorld();
  
  // hover tooltip semplice
  drawSimpleHover();
  
  // solo leggenda
  drawLegend();
  
  // titolo e descrizione del sito
  drawTitleAndDescription();
  
  // pannello di dettaglio con spider chart
  if (detailPanel.open && selectedCountry) {
    drawDetailPanel();
  }
}

// --------------------
// Funzione di sicurezza per CSV
// --------------------
function safeGetString(row, colName) {
  if (!populationData) return '';
  try {
    let v = populationData.getString(row, colName);
    if (v === undefined || v === null) return '';
    return v.toString();
  } catch (e) {
    console.warn('Error getting string for row', row, 'col', colName, ':', e);
    return '';
  }
}

function safeGetNumber(row, colName) {
  let str = safeGetString(row, colName);
  // Rimuove caratteri speciali come %, virgole, e caratteri unicode come −
  let cleanStr = str.replace(/[%,−]/g, '').replace(/[^\d.-]/g, '');
  let num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

// --------------------
// Disegno mondo
// --------------------
function drawWorld() {
  if (!worldGeo || !worldGeo.features) return;

  push();
  stroke(255, 255, 255, 80);
  strokeWeight(0.5);

  // Disegna ogni paese
  for (let feature of worldGeo.features) {
    let countryName = feature.properties.name;
    let populationValue = getPopulationForCountry(countryName);
    
    // Colora il paese in base alla popolazione
    fill(getColorForPopulation(populationValue));
    
    let geom = feature.geometry;
    if (!geom) continue;

    if (geom.type === 'Polygon') {
      drawPolygon(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (let poly of geom.coordinates) drawPolygon(poly);
    }
  }

  pop();
}

// Disegna un poligono dato un array di coordinate
function drawPolygon(coordArray) {
  beginShape();
  for (let ring of coordArray) {
    for (let c of ring) {
      let lon = c[0];
      let lat = c[1];
      let x = map(lon, -180, 180, 0, width);
      let y = map(lat, 85, -85, 0, height);
      vertex(x, y);
    }
  }
  endShape(CLOSE);
}

// --------------------
// Funzioni per i dati di popolazione
// --------------------
function getPopulationForCountry(geoCountryName) {
  if (!populationData) return 0;
  
  for (let r = 0; r < populationData.getRowCount(); r++) {
    let csvCountryName = safeGetString(r, COLS.country);
    
    if (csvCountryName === geoCountryName) {
      return safeGetNumber(r, COLS.population);
    }
  }
  return 0;
}

function getColorForPopulation(population) {
  if (population === 0) return color(80, 80, 80); // grigio per dati mancanti
  
  // Scala logaritmica per la popolazione
  let logPop = Math.log10(population);
  
  // Range da 10k a 1.4 miliardi (log 4 a log 9.15 circa)
  let minLog = 4;   // 10,000
  let maxLog = 9.2; // ~1.4 miliardi
  
  let t = constrain((logPop - minLog) / (maxLog - minLog), 0, 1);
  
  // Gradiente da blu scuro a rosso intenso
  if (t < 0.2) {
    // Blu molto scuro -> Blu
    return lerpColor(color(20, 30, 60), color(50, 80, 150), t * 5);
  } else if (t < 0.4) {
    // Blu -> Verde
    return lerpColor(color(50, 80, 150), color(50, 150, 100), (t - 0.2) * 5);
  } else if (t < 0.6) {
    // Verde -> Giallo
    return lerpColor(color(50, 150, 100), color(200, 200, 50), (t - 0.4) * 5);
  } else if (t < 0.8) {
    // Giallo -> Arancione
    return lerpColor(color(200, 200, 50), color(255, 150, 50), (t - 0.6) * 5);
  } else {
    // Arancione -> Rosso intenso
    return lerpColor(color(255, 150, 50), color(200, 50, 50), (t - 0.8) * 5);
  }
}

// --------------------
// Funzioni per pannello di dettaglio
// --------------------
function getCountryData(geoCountryName) {
  if (!populationData) {
    console.warn('populationData not loaded yet');
    return null;
  }
  
  try {
    let rowCount = populationData.getRowCount();
    console.log('Searching for country:', geoCountryName, 'in', rowCount, 'rows');
    
    for (let r = 0; r < rowCount; r++) {
      let csvCountryName = safeGetString(r, COLS.country);
      
      if (csvCountryName === geoCountryName) {
        console.log('Found country data for:', geoCountryName);
        return {
          population: safeGetNumber(r, COLS.population),
          yearlyChange: safeGetNumber(r, COLS.yearlyChange),
          density: safeGetNumber(r, COLS.density),
          medianAge: safeGetNumber(r, COLS.medianAge),
          urbanPop: safeGetNumber(r, COLS.urbanPop),
          fertilityRate: safeGetNumber(r, COLS.fertilityRate),
          worldShare: safeGetNumber(r, COLS.worldShare),
          landArea: safeGetNumber(r, COLS.landArea)
        };
      }
    }
    console.warn('Country not found in CSV:', geoCountryName);
    return null;
  } catch (e) {
    console.error('Error in getCountryData:', e);
    return null;
  }
}

// Funzioni di normalizzazione basate sulla MEDIA MONDIALE (50 = media, 0-100 scala relativa)
const WORLD_AVERAGES = {
  population: 47658246.33,    // Media popolazione mondiale
  growth: 1.56,               // Media crescita annuale
  density: 136.57,            // Media densità
  medianAge: 27.02,           // Media età mediana
  urban: 59.41,               // Media urbanizzazione
  fertility: 2.74             // Media fertilità
};

function normalizePopulation(population) {
  if (population <= 0) return 0;
  // Scala logaritmica centrata sulla media mondiale
  let ratio = population / WORLD_AVERAGES.population;
  let logRatio = Math.log10(ratio);
  // Se uguale alla media = 50, se 10x la media = 100, se 1/10 della media = 0
  return constrain(map(logRatio, -1, 1, 0, 100), 0, 100);
}

function normalizeGrowth(yearlyChange) {
  // Basato sulla media mondiale (1.56%)
  let ratio = yearlyChange / WORLD_AVERAGES.growth;
  // Se uguale alla media = 50, se doppio = 100, se zero = 0
  return constrain(map(ratio, 0, 2.5, 0, 100), 0, 100);
}

function normalizeDensity(density) {
  if (density <= 0) return 0;
  // Scala logaritmica centrata sulla media mondiale
  let ratio = density / WORLD_AVERAGES.density;
  let logRatio = Math.log10(ratio);
  // Se uguale alla media = 50
  return constrain(map(logRatio, -1, 1, 0, 100), 0, 100);
}

function normalizeYouth(medianAge) {
  // Età più bassa = più giovane = punteggio più alto
  // Invertito rispetto alla media: se età = media mondiale = 50
  let ratio = WORLD_AVERAGES.medianAge / medianAge; // Invertito
  return constrain(map(ratio, 0.5, 2, 0, 100), 0, 100);
}

function normalizeUrban(urbanPop) {
  // Basato sulla media mondiale (59.41%)
  let ratio = urbanPop / WORLD_AVERAGES.urban;
  return constrain(map(ratio, 0, 2, 0, 100), 0, 100);
}

function normalizeFertility(fertilityRate) {
  // Basato sulla media mondiale (2.74)
  let ratio = fertilityRate / WORLD_AVERAGES.fertility;
  return constrain(map(ratio, 0, 2.5, 0, 100), 0, 100);
}

// --------------------
// Hover semplice
// --------------------
function drawSimpleHover() {
  if (!worldGeo) return;

  // Coordinate dirette senza zoom
  let mouseLon = map(mouseX, 0, width, -180, 180);
  let mouseLat = map(mouseY, 0, height, 85, -85);
  
  // Controlla tutti i paesi per vedere se il mouse è sopra uno di essi
  for (let feature of worldGeo.features) {
    if (isMouseOverCountry(mouseLon, mouseLat, feature)) {
      // Mostra il nome del paese
      showSimpleTooltip(feature.properties.name, mouseX + 12, mouseY + 12);
      return; // Esci appena trovi il primo paese
    }
  }
}

function isMouseOverCountry(lon, lat, feature) {
  let geom = feature.geometry;
  if (!geom) return false;
  
  // Gestisce sia Polygon che MultiPolygon
  if (geom.type === 'Polygon') {
    return checkAllRings(lon, lat, geom.coordinates);
  } else if (geom.type === 'MultiPolygon') {
    // Per i MultiPolygon, controlla ogni singolo poligono
    for (let polygon of geom.coordinates) {
      if (checkAllRings(lon, lat, polygon)) {
        return true;
      }
    }
  }
  
  return false;
}

function checkAllRings(lon, lat, polygonCoords) {
  // Controlla il primo anello (contorno esterno)
  if (polygonCoords && polygonCoords[0]) {
    return pointInPolygonSimple(lon, lat, polygonCoords[0]);
  }
  return false;
}

function pointInPolygonSimple(x, y, polygon) {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  let j = polygon.length - 1;
  
  for (let i = 0; i < polygon.length; i++) {
    let xi = polygon[i][0];
    let yi = polygon[i][1];
    let xj = polygon[j][0];
    let yj = polygon[j][1];
    
    // Evita divisioni per zero e casi limite
    if (yi === yj) {
      j = i;
      continue;
    }
    
    // Ray casting migliorato
    if (((yi > y) !== (yj > y))) {
      let intersectX = (xj - xi) * (y - yi) / (yj - yi) + xi;
      if (x < intersectX) {
        inside = !inside;
      }
    }
    
    j = i;
  }
  
  return inside;
}

function showSimpleTooltip(countryName, x, y) {
  // Calcola dimensioni tooltip
  textSize(12);
  textStyle(BOLD);
  let w = textWidth(countryName);
  let h = 20;
  
  // Riposiziona per rimanere dentro il canvas
  let bx = x;
  let by = y;
  if (bx + w + 16 > width) bx = x - (w + 16);
  if (by + h + 8 > height) by = height - (h + 8);
  if (bx < 6) bx = 6;
  if (by < 6) by = 6;
  
  // Disegna tooltip semplice
  push();
  fill(0, 200);
  stroke(255);
  strokeWeight(1);
  rect(bx, by, w + 12, h + 4, 4);
  
  fill(255);
  noStroke();
  textStyle(BOLD);
  textAlign(LEFT);
  text(countryName, bx + 6, by + 14);
  pop();
}

// --------------------
// Leggenda popolazione
// --------------------
function drawLegend() {
  let legendX = 10;
  let legendY = height - 190; // Allineata in basso alla pagina
  let legendWidth = 230;
  let legendHeight = 170;
  
  // Sfondo leggenda
  push();
  fill(0, 180);
  stroke(255);
  strokeWeight(1);
  rect(legendX, legendY, legendWidth, legendHeight, 5);
  
  // Titolo leggenda
  fill(255);
  textAlign(LEFT);
  textSize(14);
  textStyle(BOLD);
  text('Population 2025', legendX + 15, legendY + 25);
  
  // Scala colori
  let colorBarY = legendY + 45;
  let colorBarHeight = 20;
  let colorBarWidth = legendWidth - 30;
  
  // Disegna la barra dei colori
  for (let i = 0; i < colorBarWidth; i++) {
    let t = i / colorBarWidth;
    let col = getColorForPopulationScale(t);
    stroke(col);
    line(legendX + 15 + i, colorBarY, legendX + 15 + i, colorBarY + colorBarHeight);
  }
  
  // Etichette della scala
  textStyle(NORMAL);
  textSize(11);
  fill(255);
  
  let labels = ['10K', '100K', '1M', '10M', '100M', '1B+'];
  let positions = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  
  for (let i = 0; i < labels.length; i++) {
    let x = legendX + 15 + positions[i] * colorBarWidth;
    text(labels[i], x - textWidth(labels[i])/2, colorBarY + colorBarHeight + 15);
  }
  
  // Info aggiuntive
  textSize(10);
  fill(200);
  text('Countries: 172', legendX + 15, legendY + 125);
  text('Data source: Kaggle - Population 2025', legendX + 15, legendY + 140);
  
  pop();
}

function drawTitleAndDescription() {
  // Posiziona a destra della legenda
  let legendX = 10;
  let legendWidth = 230;
  let titleX = legendX + legendWidth + 320; // A destra della legenda con margine
  let titleY = height - 170; // Stesso livello superiore della legenda
  
  push();
  
  // Titolo principale
  fill(255);
  textAlign(LEFT, TOP);
  textSize(36);
  textStyle(BOLD);
  text('World Population Explorer ', titleX, titleY);
  
  // Descrizione
  textSize(14);
  textStyle(NORMAL);
  fill(200);
  let descY = titleY + 50;
  text('Interactive visualization of global population data.', titleX, descY);
  text('• Hover over countries to see the name', titleX, descY + 22);
  text('• Click to open demographic insights with spider chart', titleX, descY + 40);
  text('• Compare data with global average', titleX, descY + 59);
  
  pop();
}

function getColorForPopulationScale(t) {
  // Stessa logica di getColorForPopulation ma con t da 0 a 1
  if (t < 0.2) {
    return lerpColor(color(20, 30, 60), color(50, 80, 150), t * 5);
  } else if (t < 0.4) {
    return lerpColor(color(50, 80, 150), color(50, 150, 100), (t - 0.2) * 5);
  } else if (t < 0.6) {
    return lerpColor(color(50, 150, 100), color(200, 200, 50), (t - 0.4) * 5);
  } else if (t < 0.8) {
    return lerpColor(color(200, 200, 50), color(255, 150, 50), (t - 0.6) * 5);
  } else {
    return lerpColor(color(255, 150, 50), color(200, 50, 50), (t - 0.8) * 5);
  }
}

function isPointInCountry(lon, lat, feature) {
  // Implementazione semplificata - controlla solo il bounding box
  let geom = feature.geometry;
  if (!geom) return false;
  
  let coords = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates[0];
  if (!coords || !coords[0]) return false;
  
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  for (let ring of coords) {
    for (let c of ring) {
      minLon = Math.min(minLon, c[0]);
      maxLon = Math.max(maxLon, c[0]);
      minLat = Math.min(minLat, c[1]);
      maxLat = Math.max(maxLat, c[1]);
    }
  }
  
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

function showTooltipForCountry(countryFeature, x, y) {
  let countryName = countryFeature.properties.name;
  let population = getPopulationForCountry(countryName);
  
  // Trova i dati completi dal CSV
  let countryData = null;
  for (let r = 0; r < populationData.getRowCount(); r++) {
    let csvCountryName = safeGetString(r, COLS.country);
    
    if (csvCountryName === countryName) {
      countryData = r;
      break;
    }
  }
  
  let lines = [];
  if (countryData !== null) {
    lines = [
      'Population: ' + formatNumber(population),
      'Density: ' + safeGetString(countryData, COLS.density) + ' P/Km²',
      'Yearly Change: ' + safeGetString(countryData, COLS.yearlyChange),
      'World Share: ' + safeGetString(countryData, COLS.worldShare),
      'Median Age: ' + safeGetString(countryData, COLS.medianAge)
    ];
  } else {
    lines = ['No data available'];
  }
  
  // Calcola dimensioni tooltip
  textSize(12);
  textStyle(BOLD);
  let nameWidth = textWidth(countryName);
  textStyle(NORMAL);
  
  let w = nameWidth;
  for (let line of lines) w = max(w, textWidth(line));
  let h = (lines.length + 1) * 16;
  
  // Riposiziona per rimanere dentro il canvas
  let bx = x;
  let by = y;
  if (bx + w + 18 > width) bx = x - (w + 18);
  if (by + h + 12 > height) by = height - (h + 12);
  if (bx < 6) bx = 6;
  if (by < 6) by = 6;
  
  // Disegna tooltip
  push();
  fill(40, 220);
  stroke(255);
  rect(bx, by, w + 12, h + 8, 6);
  
  fill(255);
  noStroke();
  
  textStyle(BOLD);
  text(countryName, bx + 6, by + 16);
  
  textStyle(NORMAL);
  for (let i = 0; i < lines.length; i++) {
    text(lines[i], bx + 6, by + 32 + i * 16);
  }
  pop();
}

function formatNumber(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// --------------------
// Pannello di dettaglio con spider chart
// --------------------
function drawDetailPanel() {
  if (!selectedCountry || !selectedCountry.data) return;
  
  push();
  
  // Sfondo del pannello
  fill(30, 30, 30, 240);
  stroke(255, 255, 255, 150);
  strokeWeight(2);
  rect(detailPanel.x, detailPanel.y, detailPanel.width, detailPanel.height, 8);
  
  // Pulsante di chiusura (X)
  fill(200, 50, 50);
  stroke(255);
  strokeWeight(1);
  rect(detailPanel.closeButton.x, detailPanel.closeButton.y, 
       detailPanel.closeButton.size, detailPanel.closeButton.size, 3);
  
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16);
  textStyle(BOLD);
  text('×', detailPanel.closeButton.x + detailPanel.closeButton.size/2, 
            detailPanel.closeButton.y + detailPanel.closeButton.size/2);
  
  // Titolo del paese
  fill(255);
  textAlign(LEFT);
  textSize(18);
  textStyle(BOLD);
  text(selectedCountry.name, detailPanel.x + 15, detailPanel.y + 25);
  
  // Informazioni base
  textSize(12);
  textStyle(NORMAL);
  let data = selectedCountry.data;
  let baseY = detailPanel.y + 50;
  
  fill(200);
  text('Population: ' + formatNumber(data.population), detailPanel.x + 15, baseY);
  text('World Share: ' + data.worldShare.toFixed(2) + '%', detailPanel.x + 15, baseY + 20);
  text('Land Area: ' + formatNumber(data.landArea) + ' km²', detailPanel.x + 15, baseY + 40);
  
  // Spider chart - più in basso e più grande
  let chartCenterX = detailPanel.x + detailPanel.width/2;
  let chartCenterY = detailPanel.y + 240;
  let chartRadius = 110;
  
  drawSpiderChart(data, chartCenterX, chartCenterY, chartRadius);
  
  pop();
}

function drawSpiderChart(data, centerX, centerY, radius) {
  // Definisce le 6 metriche per lo spider chart
  let metrics = [
    {name: 'Population', value: normalizePopulation(data.population), color: color(100, 150, 255)},
    {name: 'Pop Annual Growth', value: normalizeGrowth(data.yearlyChange), color: color(100, 255, 100)},
    {name: 'Density (people/km²)', value: normalizeDensity(data.density), color: color(255, 200, 100)},
    {name: 'Young Pop', value: normalizeYouth(data.medianAge), color: color(255, 100, 150)},
    {name: 'Urbanization', value: normalizeUrban(data.urbanPop), color: color(150, 100, 255)},
    {name: 'Fertility', value: normalizeFertility(data.fertilityRate), color: color(255, 150, 100)}
  ];
  
  let numMetrics = metrics.length;
  let angleStep = TWO_PI / numMetrics;
  
  push();
  
  // Disegna i cerchi di sfondo (griglia)
  noFill();
  for (let i = 1; i <= 4; i++) {
    let r = (radius * i) / 4;
    
    // La linea del 50% (media mondiale) è speciale
    if (i === 2) { // 2/4 = 50%
      // Cerchio tratteggiato rosso poco saturo per la media
      drawDashedCircle(centerX, centerY, r * 2, color(200, 80, 80, 150), 2);
    } else {
      stroke(100, 100, 100, 100); // Grigio per le altre
      strokeWeight(1);
      ellipse(centerX, centerY, r * 2, r * 2);
    }
  }
  
  // Disegna gli assi con il colore del rispettivo pallino
  strokeWeight(2);
  for (let i = 0; i < numMetrics; i++) {
    let angle = i * angleStep - PI/2; // Inizia dall'alto
    let x = centerX + cos(angle) * radius;
    let y = centerY + sin(angle) * radius;
    
    // Usa il colore del pallino per l'asse, ma con trasparenza
    stroke(red(metrics[i].color), green(metrics[i].color), blue(metrics[i].color), 120);
    line(centerX, centerY, x, y);
  }
  
  // Etichetta per la linea della media mondiale
  fill(220, 100, 100, 200); // Rosso poco saturo ma più visibile
  stroke(255, 255, 255, 100); // Contorno bianco sottile per leggibilità
  strokeWeight(0.5);
  textAlign(LEFT, CENTER);
  textSize(8); // Testo più piccolo
  textStyle(NORMAL); // Non più grassetto per essere meno invasivo
  text('World Avg', centerX + radius * 0.5 + 5, centerY);
  
  // Disegna l'area del paese
  fill(100, 150, 255, 100);
  stroke(100, 150, 255, 200);
  strokeWeight(2);
  beginShape();
  for (let i = 0; i < numMetrics; i++) {
    let angle = i * angleStep - PI/2;
    let value = metrics[i].value / 100; // Normalizza a 0-1
    let x = centerX + cos(angle) * radius * value;
    let y = centerY + sin(angle) * radius * value;
    vertex(x, y);
  }
  endShape(CLOSE);
  
  // Disegna i punti e le etichette
  for (let i = 0; i < numMetrics; i++) {
    let angle = i * angleStep - PI/2;
    let value = metrics[i].value / 100;
    let x = centerX + cos(angle) * radius * value;
    let y = centerY + sin(angle) * radius * value;
    
    // Punto sul grafico
    fill(metrics[i].color);
    noStroke();
    ellipse(x, y, 6, 6);
    
    // Etichetta
    let labelX = centerX + cos(angle) * (radius + 25);
    let labelY = centerY + sin(angle) * (radius + 25);
    
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(10);
    textStyle(BOLD);
    text(metrics[i].name, labelX, labelY);
    
    // Valore relativo alla media mondiale (50 = media)
    textSize(8);
    textStyle(NORMAL);
    fill(200);
    let relativeValue = Math.round(metrics[i].value);
    let label = relativeValue === 50 ? '= avg' : (relativeValue > 50 ? '+' + (relativeValue - 50) : (relativeValue - 50));
    text(label, labelX, labelY + 12);
  }
  
  pop();
}

// Zoom rimosso - codice più semplice

function mousePressed() {
  // Controlla se dobbiamo chiudere il pannello
  if (detailPanel.open) {
    if (mouseX >= detailPanel.closeButton.x && mouseX <= detailPanel.closeButton.x + detailPanel.closeButton.size &&
        mouseY >= detailPanel.closeButton.y && mouseY <= detailPanel.closeButton.y + detailPanel.closeButton.size) {
      detailPanel.open = false;
      selectedCountry = null;
      return;
    }
    
    // Controlla se iniziamo a trascinare la card
    if (mouseX >= detailPanel.x && mouseX <= detailPanel.x + detailPanel.width &&
        mouseY >= detailPanel.y && mouseY <= detailPanel.y + detailPanel.height) {
      isDragging = true;
      dragOffsetX = mouseX - detailPanel.x;
      dragOffsetY = mouseY - detailPanel.y;
      return;
    }
  }
  
  // Prova ad aprire pannello paese
  openCountryPanel();
}

// Versione SEMPLICE senza zoom: coordinate dirette
function openCountryPanel() {
  if (!worldGeo || !populationData) return;
  
  // Coordinate dirette senza zoom
  let mouseLon = map(mouseX, 0, width, -180, 180);
  let mouseLat = map(mouseY, 0, height, 85, -85);
  
  console.log("Click at mouse:", mouseX, mouseY, "-> geo:", mouseLon.toFixed(2), mouseLat.toFixed(2));
  
  // Cerca il paese cliccato con lo STESSO metodo dell'hover
  let foundCountry = null;
  for (let feature of worldGeo.features) {
    if (isMouseOverCountry(mouseLon, mouseLat, feature)) {
      foundCountry = feature;
      console.log("Found country:", feature.properties.name);
      break;
    }
  }
  
  if (!foundCountry) {
    console.log("No country found at this location");
    return; // Nessun paese trovato
  }
  
  let countryName = foundCountry.properties.name;
  
  // Cerca i dati del paese
  let countryData = getCountryData(countryName);
  
  if (countryData) {
    console.log("Opening panel for:", countryName);
    
    // Aggiorna i dati del paese selezionato
    selectedCountry = {
      name: countryName,
      data: countryData,
      feature: foundCountry
    };
    
    // Imposta la posizione solo se la card non è già aperta
    if (!detailPanel.open) {
      detailPanel.x = width - detailPanel.width - 20;
      detailPanel.y = height - detailPanel.height - 20;
    }
    
    // Aggiorna sempre la posizione del bottone chiudi (segue la card)
    detailPanel.closeButton.x = detailPanel.x + detailPanel.width - 30;
    detailPanel.closeButton.y = detailPanel.y + 5;
    detailPanel.open = true;
  } else {
    console.log("No data found for:", countryName);
  }
}

// Rimossa funzione isPointInCountrySimple - ora usiamo la stessa logica precisa dell'hover

function mouseDragged() {
  // Trascina la card se stiamo facendo drag
  if (isDragging && detailPanel.open) {
    detailPanel.x = mouseX - dragOffsetX;
    detailPanel.y = mouseY - dragOffsetY;
    
    // Limiti per non uscire dai bordi dello schermo
    detailPanel.x = constrain(detailPanel.x, 0, width - detailPanel.width);
    detailPanel.y = constrain(detailPanel.y, 0, height - detailPanel.height);
    
    // Aggiorna posizione del bottone di chiusura
    detailPanel.closeButton.x = detailPanel.x + detailPanel.width - 30;
    detailPanel.closeButton.y = detailPanel.y + 5;
  }
}

function mouseReleased() {
  // Ferma il dragging
  isDragging = false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Funzione per disegnare un cerchio tratteggiato
function drawDashedCircle(x, y, diameter, col, weight) {
  let radius = diameter / 2;
  let circumference = TWO_PI * radius;
  let dashLength = 8; // Lunghezza di ogni trattino
  let gapLength = 6;  // Lunghezza di ogni spazio
  let totalDashUnit = dashLength + gapLength;
  let numDashes = floor(circumference / totalDashUnit);
  
  stroke(col);
  strokeWeight(weight);
  
  for (let i = 0; i < numDashes; i++) {
    let startAngle = (i * totalDashUnit / radius);
    let endAngle = startAngle + (dashLength / radius);
    
    let startX = x + cos(startAngle) * radius;
    let startY = y + sin(startAngle) * radius;
    let endX = x + cos(endAngle) * radius;
    let endY = y + sin(endAngle) * radius;
    
    // Disegna piccoli archi invece di linee per seguire la curvatura
    noFill();
    arc(x, y, diameter, diameter, startAngle, endAngle);
  }
}
