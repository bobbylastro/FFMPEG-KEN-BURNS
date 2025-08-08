const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

// Chemins d'entrée / sortie
const inputImage = path.join(__dirname, 'image.jpg'); // ton image source
const outputVideo = path.join(__dirname, 'kenburns.mp4');

// Paramètres
const duration = 4; // secondes
const fps = 30;
const zoom = 1.5; // 150%

// Filtre FFmpeg pour Ken Burns horizontal (gauche -> droite)
const zoompanFilter = `zoompan=z=${zoom}:x='(iw-ow)*on/(${duration * fps})':y='(ih-oh)/2':d=${duration * fps}:s=720x1280,framerate=${fps}`;

ffmpeg(inputImage)
  .outputOptions([
    '-vf', zoompanFilter,
    '-c:v libx264',
    '-pix_fmt yuv420p'
  ])
  .on('start', (cmd) => {
    console.log('Commande FFmpeg :', cmd);
  })
  .on('progress', (progress) => {
    process.stdout.write(`\rProgression : ${progress.percent ? progress.percent.toFixed(1) : 0}%`);
  })
  .on('end', () => {
    console.log('\n✅ Vidéo Ken Burns générée avec succès !');
    console.log('Fichier :', outputVideo);
  })
  .on('error', (err) => {
    console.error('Erreur :', err.message);
  })
  .save(outputVideo);
