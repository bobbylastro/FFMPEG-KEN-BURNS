const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TMP_DIR = path.join(__dirname, 'tmp');

// Crée le dossier tmp s’il n’existe pas
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

app.post('/generate', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl manquant' });

  const imagePath = path.join(TMP_DIR, `${uuidv4()}.jpg`);
  const videoPath = path.join(TMP_DIR, `${uuidv4()}.mp4`);

  try {
    // 1. Télécharger l’image
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Erreur téléchargement image');
    const buffer = await response.buffer();
    fs.writeFileSync(imagePath, buffer);

    // 2. Paramètres FFmpeg
    const duration = 4; // secondes
    const fps = 30;
    const zoom = 1.5;
    const zoompanFilter = `zoompan=z=${zoom}:x='(iw-ow)*on/(${duration * fps})':y='(ih-oh)/2':d=${duration * fps}:s=720x1280,framerate=${fps}`;

    // 3. Générer la vidéo
    await new Promise((resolve, reject) => {
      ffmpeg(imagePath)
        .outputOptions([
          '-vf', zoompanFilter,
          '-c:v libx264',
          '-pix_fmt yuv420p',
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(videoPath);
    });

    // 4. Ici il faudrait uploader la vidéo vers un service de stockage (ex: Cloudinary, S3)
    // Pour l’exemple, on renvoie juste le chemin local (pas accessible publiquement)
    // Tu devras adapter cette partie pour uploader la vidéo et renvoyer une URL publique.

    res.json({
      message: 'Vidéo générée avec succès',
      videoUrl: `/videos/${path.basename(videoPath)}`, // temporaire
    });

    // Nettoyage possible des fichiers après un certain temps...

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Optionnel : servir les vidéos générées (juste pour test, pas recommandé en prod)
app.use('/videos', express.static(path.join(__dirname, 'tmp')));

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
