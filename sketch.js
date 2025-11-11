let populationData = null;
let worldGeo = null;

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

// Variabili per trascinare la card
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// adattament nomi delle colonne nel CSV
let COLS = {
  country: 'Country (or dependency)',
  population: 'Population 2025',
  yearlyChange: 'Yearly Change',
  density: 'Density (P/Km²)',
  landArea: 'Land Area (Km²)',
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
  
  // Calcola le medie mondiali dai dati CSV
  calculateWorldAverages();
}

function draw() {
  background(20);

  // disegna la mappa 
  drawWorld();
  
  // hover tooltip con nome paese
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
//per confrontare i nomi dei paesi tra CSV e GeoJSON e gestire valori mancanti
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
  for (let feature of worldGeo.features) { //feature variabile che contiene tutte le informazioni geografiche di un paese specifico. Prende dal JSON
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

// Disegna un poligono dato un array di coordinate del file JSON
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
  if (!populationData) return 0; //se manca o non è valido dai 0
  
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
  
  // Gradiente con interpolazione da blu scuro a rosso intenso
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
  // Controllo semplice: se non ci sono dati, restituisci null
  if (!populationData) return null;
  
  // Cerca il paese nel CSV
  for (let r = 0; r < populationData.getRowCount(); r++) {
    let csvCountryName = safeGetString(r, COLS.country);
    
    if (csvCountryName === geoCountryName) {
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
  
  // Se arriviamo qui, il paese non è stato trovato
  return null;
}

// FUNZIONI PER CALCOLARE LA MEDIA MONDIALE (50 = media, 0-100 scala relativa)

//creo variabili per le medie mondiali
let WORLD_AVERAGES = {
  population: 0,
  growth: 0,
  density: 0,
  medianAge: 0,
  urban: 0,
  fertility: 0
};

// Calcola le medie mondiali dai dati CSV
function calculateWorldAverages() {
  if (!populationData) return;
  
  // Inizializza totali
  let totals = {
    population: 0,
    growth: 0,
    density: 0,
    medianAge: 0,
    urban: 0,
    fertility: 0
  };

  // Contatore per i valori validi
  let count = 0;
  
  // Somma tutti i valori
  for (let r = 0; r < populationData.getRowCount(); r++) {
    let pop = safeGetNumber(r, COLS.population);
    let growth = safeGetNumber(r, COLS.yearlyChange);
    let density = safeGetNumber(r, COLS.density);
    let age = safeGetNumber(r, COLS.medianAge);
    let urban = safeGetNumber(r, COLS.urbanPop);
    let fertility = safeGetNumber(r, COLS.fertilityRate);
    
    // Solo se tutti i dati sono validi allora dice che il numero di pop corrisponde a totals.population
    if (pop > 0 && age > 0 && fertility > 0) {
      totals.population += pop;
      totals.growth += growth;
      totals.density += density;
      totals.medianAge += age;
      totals.urban += urban;
      totals.fertility += fertility;
      count++;
    }
  }
  
  // Calcola le medie facendo il totale diviso per il numero dei valori validi
  if (count > 0) {
    WORLD_AVERAGES.population = totals.population / count;
    WORLD_AVERAGES.growth = totals.growth / count;
    WORLD_AVERAGES.density = totals.density / count;
    WORLD_AVERAGES.medianAge = totals.medianAge / count;
    WORLD_AVERAGES.urban = totals.urban / count;
    WORLD_AVERAGES.fertility = totals.fertility / count;
    
  
  }
}

//funzione per capire situazione relativa rispetto alla media mondiale

//POPOLAZIONE
function normalizePopulation(population) {
  if (population <= 0) return 0;
  
  // Confronto con la media mondiale (es: se Italia ha 60M e media è 47M -> ratio = 1.26)
  let ratio = population / WORLD_AVERAGES.population;
  
  // Uso logaritmo per gestire numeri enormi
  let logRatio = Math.log10(ratio);
  
  // Converto in punteggio 0-100 dove 50 = media mondiale
  // -2 significa 1/100 della media (0 punti), +2 significa 100x la media (100 punti)
  return constrain(map(logRatio, -2, 2, 0, 100), 0, 100);
}

function normalizeGrowth(yearlyChange) {
  // Basato sulla media mondiale (1.56%)
  let ratio = yearlyChange / WORLD_AVERAGES.growth;
  // Se uguale alla media = 50, se doppio = 100, se metà = 0
  return constrain(map(ratio, 0, 2.5, 0, 100), 0, 100);
}

function normalizeDensity(density) {
  if (density <= 0) return 0;
  // Scala logaritmica centrata sulla media mondiale
  let ratio = density / WORLD_AVERAGES.density;
  let logRatio = Math.log10(ratio);
  // Se uguale alla media = 50, se 100x la media = 100
  return constrain(map(logRatio, -2, 2, 0, 100), 0, 100);
}

function normalizeYouth(medianAge) {
  // Età più bassa = più giovane = punteggio più alto
  // Invertito rispetto alla media: se età = media mondiale = 50
  let ratio = WORLD_AVERAGES.medianAge / medianAge; // Invertito
  return constrain(map(ratio, 0.5, 2, 0, 100), 0, 100);
}

function normalizeUrban(urbanPop) {
  // Basato sulla media mondiale
  let ratio = urbanPop / WORLD_AVERAGES.urban;
  return constrain(map(ratio, 0, 2, 0, 100), 0, 100);
}

function normalizeFertility(fertilityRate) {
  // Basato sulla media mondiale
  let ratio = fertilityRate / WORLD_AVERAGES.fertility;
  return constrain(map(ratio, 0, 2.5, 0, 100), 0, 100);
}

// --------------------
// Hover semplice
// --------------------
function drawSimpleHover() {
  if (!worldGeo) return;

  // Coordinate del mouse in longitudine e latitudine
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
  // Prendi la geometria del paese (forma e coordinate)
  let geom = feature.geometry;
  if (!geom) return false; // Se non ha geometria, salta questo paese
  
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

//funzione che serve a controllare se sei all'interno dei bordi esterni di un paese nella mappa
function checkAllRings(lon, lat, polygonCoords) {

  if (polygonCoords && polygonCoords[0]) {
    return pointInPolygonSimple(lon, lat, polygonCoords[0]);
  }
  return false;
}

function pointInPolygonSimple(x, y, polygon) {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  let j = polygon.length - 1;
  
  //Lancio un raggio dal punto verso destra. Se attraversa i bordi del paese un numero PARI di volte sono fuori. Se DISPARI sono dentro! (se tocco una sola volta il bordo...significa che sono dentro)
  for (let i = 0; i < polygon.length; i++) {
    let xi = polygon[i][0];
    let yi = polygon[i][1];
    let xj = polygon[j][0];
    let yj = polygon[j][1];
    
    // Evita divisioni per zero e casi limite - evita crash o infinito
    if (yi === yj) {
      j = i;
      continue;
    }
    
    // formula utile a capire se il raggio interseca il lato del poligono
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
  let legendY = height - 190; 
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
  
  // Spiegazione mapping logaritmico
  textSize(12);
  fill(150);
  text('Spider chart uses logarithmic scaling: 50 = world average,', titleX, descY + 85);
  text('values scale from 1/100x (0 points) to 100x (100 points) the average.', titleX, descY + 100);
  
  pop();
}

function getColorForPopulationScale(t) {
  // Stessa logica di getColorForPopulation ma con t da 0 a 1 //in modo da creare la barra della leggenda colorata gradualmente 
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

// Funzione per formattare numeri grandi in migliaia, milioni, miliardi
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
  
       // Disegna la X all'interno del pulsante di chiusura
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
  
  // Spider chart - posizionato al centro del pannello
  let chartCenterX = detailPanel.x + detailPanel.width/2;
  let chartCenterY = detailPanel.y + 240;
  let chartRadius = 110;
  
  drawSpiderChart(data, chartCenterX, chartCenterY, chartRadius);
  
  pop();
}

function drawSpiderChart(data, centerX, centerY, radius) {
  // Definisce le 6 metriche per lo spider chart
  let metrics = [
    {name: 'Population', value: normalizePopulation(data.population), color: color(100, 150, 255)}, // Blu
    {name: 'Pop Annual Growth', value: normalizeGrowth(data.yearlyChange), color: color(100, 255, 100)}, // Verde
    {name: 'Density (people/km²)', value: normalizeDensity(data.density), color: color(255, 200, 100)}, // Giallo
    {name: 'Young Pop', value: normalizeYouth(data.medianAge), color: color(255, 100, 150)}, // Rosa
    {name: 'Urbanization', value: normalizeUrban(data.urbanPop), color: color(150, 100, 255)}, // Viola
    {name: 'Fertility', value: normalizeFertility(data.fertilityRate), color: color(255, 150, 100)} // Arancione
  ];
  
  let numMetrics = metrics.length; // 6 metriche (prende il numero delle metriche dal numero di name in metrics)
  let angleStep = TWO_PI / numMetrics; 
  //TWO_PI è una costante p5.js che vale 2π radianti (360 gradi)
  // angleStep = 2π / 6 = π/3 radianti per ogni metrica
  
  push();
  
  // Disegna i 4 cerchi di sfondo (griglia)
  noFill();
  for (let i = 1; i <= 4; i++) {
    let r = (radius * i) / 4;
    
    // La linea del 50% (media mondiale) è speciale
    if (i === 2) { 
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
    stroke(red(metrics[i].color), green(metrics[i].color), blue(metrics[i].color), 120); //modifichi la trasparenza in rgb
    line(centerX, centerY, x, y);
  }
  
  // Etichetta per la linea della media mondiale
  fill(220, 100, 100, 200); // Rosso poco saturo
  strokeWeight(0.5);
  textAlign(LEFT, CENTER);
  textSize(8); 
  textStyle(NORMAL); 
  text('World Avg', centerX + radius * 0.5 + 5, centerY);
  
  // Disegna l'area del paese
  fill(100, 150, 255, 100);
  stroke(100, 150, 255, 200);
  strokeWeight(2);
  beginShape(); // Inizia a disegnare il poligono dell'area del paese
  for (let i = 0; i < numMetrics; i++) {
    let angle = i * angleStep - PI/2; // Calcola l'angolo per questa metrica (inizia dall'alto)
    let value = metrics[i].value / 100; // Normalizza il valore da 0-100 a 0-1 per il raggio
    // Converte coordinate polari (angolo, distanza) in coordinate cartesiane (x, y)
    let x = centerX + cos(angle) * radius * value; // X = centro + coseno * raggio * valore normalizzato
    let y = centerY + sin(angle) * radius * value; // Y = centro + seno * raggio * valore normalizzato
    vertex(x, y); // Aggiunge questo punto al poligono
  }
  endShape(CLOSE); // Chiude il poligono collegando l'ultimo punto al primo
  
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
    let relativeValue = Math.round(metrics[i].value);
    let label = relativeValue === 50 ? '= avg' : (relativeValue > 50 ? '+' + (relativeValue - 50) : (relativeValue - 50));
    
    // Colora in base al valore: verde se sopra media, rosso se sotto, grigio se uguale
    if (relativeValue > 50) {
      fill(100, 200, 100); // Verde per valori sopra la media
    } else if (relativeValue < 50) {
      fill(255, 100, 100); // Rosso per valori sotto la media
    } else {
      fill(200); // Grigio per valori uguali alla media
    }
    
    text(label, labelX, labelY + 12);
  }
  
  pop();
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
    
    // Disegna piccoli archi invece di linee per seguire la curvatura
    noFill();
    arc(x, y, diameter, diameter, startAngle, endAngle);
  }
}

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

// Versione SEMPLICE 
function openCountryPanel() {
  if (!worldGeo || !populationData) return;
  
  // Coordinate dirette senza zoom
  let mouseLon = map(mouseX, 0, width, -180, 180);
  let mouseLat = map(mouseY, 0, height, 85, -85);
  
  
  
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
