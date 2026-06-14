import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, image } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }

    // Siapkan konten
    let userContent = message;
    if (image && image.startsWith('data:image')) {
      userContent = `${message}\n\n[User mengirimkan gambar dalam format base64]`;
    }

    // Panggil Groq API
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Anda adalah asisten AI yang ramah dan membantu. Berikan jawaban yang singkat, jelas, dan informatif dalam bahasa Indonesia.'
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
    });

    const reply = completion.choices[0]?.message?.content || 'Maaf, saya tidak bisa menjawab saat ini.';
    
    res.status(200).json({ reply });
  } catch (error) {
    console.error('Error detail:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server: ' + error.message });
  }
}