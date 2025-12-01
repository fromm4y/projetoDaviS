// Variáveis e seleção de elementos
    const body = document.body;
    const header = document.getElementById('siteHeader');
    const themeToggle = document.getElementById('themeToggle');
    const yearEl = document.getElementById('year');

    // Inserir ano atual no rodapé
    yearEl.textContent = new Date().getFullYear();

    // Tema salvo no localStorage (simples)
    const savedTheme = localStorage.getItem('vd_theme');
    if(savedTheme === 'dark'){
      enableDarkMode(true);
    }

    // Alternar modo claro/escuro
    themeToggle.addEventListener('click', () => {
      const isDark = body.classList.toggle('dark');
      // ajustar header para aparência coerente
      header.classList.toggle('darkHeader', isDark);
      themeToggle.setAttribute('aria-pressed', String(isDark));
      themeToggle.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
      localStorage.setItem('vd_theme', isDark ? 'dark' : 'light');
    });

    function enableDarkMode(force){
      if(force){
        body.classList.add('dark');
        header.classList.add('darkHeader');
        themeToggle.textContent = 'Modo Claro';
        themeToggle.setAttribute('aria-pressed','true');
      } else {
        body.classList.remove('dark');
        header.classList.remove('darkHeader');
        themeToggle.textContent = 'Modo Escuro';
        themeToggle.setAttribute('aria-pressed','false');
      }
    }

    // Acessibilidade: fechar painéis com Escape
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape'){
        if(chatPanel.classList.contains('open')) abrirChatbot();
      }
    });

    // Smooth scroll para 'Voltar ao topo'
    function scrollToTop(ev){
      if(ev) ev.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Expor algumas funções no escopo global para testes (opcional)
    window.scrollToTop = scrollToTop;

    // Pequena animação de entrada (fade-in)
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.card, .heroCard, .icon-item, .gallery figure').forEach((el, i) => {
        el.style.opacity = 0;
        el.style.transform = 'translateY(8px)';
        setTimeout(() => {
          el.style.transition = 'opacity 420ms ease, transform 420ms ease';
          el.style.opacity = 1;
          el.style.transform = 'translateY(0)';
        }, 90 * i);
      });
    });

    /* TODO:
       - Atualizar textos finais e fontes com links diretos (licenças de imagens).
       - Substituir imagens temporárias por imagens próprias/otimizadas.
       - Integrar backend do chatbot e módulo de reconhecimento facial (ESP32-CAM) quando disponível.
    */

// ----------------- Chatbot -----------------
const botaoChat = document.getElementById("btnAbrirChatbot");
const dfMessenger = document.querySelector("df-messenger");


botaoChat.addEventListener("click", () => {
    dfMessenger.classList.toggle("aberto");
    dfMessenger.setAttribute("opened", dfMessenger.classList.contains("aberto"));
});

// ----------------- Variáveis globais -----------------
let stream = null;
let modelosCarregados = false;

// Elementos DOM
document.addEventListener("DOMContentLoaded", () => {
  const abrirIA = document.getElementById('abrirIA');
  const cameraModal = document.getElementById('cameraModal');
  const fecharModal = document.getElementById('fecharModal');
  const video = document.getElementById('video');
  const tirarFoto = document.getElementById('tirarFoto');
  const fotoCanvas = document.getElementById('fotoCanvas');
  const modalStatus = document.getElementById('modalStatus');

  // ----------------- Carregar modelos -----------------
  async function carregarModelos() {
    if (modelosCarregados) return;
    modalStatus.innerText = 'Carregando modelos...';
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceExpressionNet.loadFromUri('/models');
      modelosCarregados = true;
      modalStatus.innerText = 'Modelos carregados.';
    } catch (err) {
      console.error('Erro carregando modelos:', err);
      modalStatus.innerText = 'Erro ao carregar modelos. Veja console.';
    }
  }

  // ----------------- Abrir modal e ativar câmera -----------------
  abrirIA.addEventListener('click', async () => {
    cameraModal.style.display = 'flex';
    cameraModal.setAttribute('aria-hidden', 'false');
    modalStatus.innerText = 'Carregando...';
    await carregarModelos();

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640 } });
      video.srcObject = stream;
      await video.play();
      modalStatus.innerText = 'Câmera ativa. Posicione seu rosto e clique em 📸';
    } catch (err) {
      console.error('Erro ao acessar a câmera:', err);
      modalStatus.innerText = 'Não foi possível acessar a câmera.';
    }
  });

  // ----------------- Fechar modal e parar câmera -----------------
  fecharModal.addEventListener('click', () => {
    pararCamera();
    cameraModal.style.display = 'none';
    cameraModal.setAttribute('aria-hidden', 'true');
    modalStatus.innerText = 'Aguardando...';
  });

  // ----------------- Parar câmera -----------------
  function pararCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
  }

  // ----------------- Tirar foto, enviar para backend e detectar emoção -----------------
  tirarFoto.addEventListener('click', async () => {
    if (!video || video.readyState < 2) {
      modalStatus.innerText = 'Vídeo não pronto. Tente novamente.';
      return;
    }

    // Desenha no canvas
    fotoCanvas.width = video.videoWidth || 640;
    fotoCanvas.height = video.videoHeight || 480;
    const ctx = fotoCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, fotoCanvas.width, fotoCanvas.height);

    modalStatus.innerText = 'Enviando foto para processamento...';

    // Para a câmera e fecha modal
    pararCamera();
    cameraModal.style.display = 'none';
    cameraModal.setAttribute('aria-hidden', 'true');

    // Converte canvas em blob para envio
    fotoCanvas.toBlob(async (blob) => {
      if (!blob) {
        modalStatus.innerText = 'Erro ao capturar a foto.';
        return;
      }

      const formData = new FormData();
      formData.append('foto', blob, 'foto.png');

      try {
        const response = await fetch(`${window.location.origin}/processar-foto`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.facesEncontradas === 0) {
          modalStatus.innerText = 'Nenhuma face detectada na foto.';
          return;
        }

        // Salva imagem no sessionStorage para página de resultado
        const dataUrl = fotoCanvas.toDataURL('image/png');
        sessionStorage.setItem('ultimaFoto', dataUrl);

        // Redireciona para a página resultado com emoção e confiança
        const emocao = data.emocao || 'neutral';
        const confianca = data.confianca || 0;
        window.location.href = `resultado.html?emocao=${encodeURIComponent(emocao)}&conf=${encodeURIComponent(confianca)}`;

      } catch (err) {
        modalStatus.innerText = 'Erro ao enviar foto para o servidor.';
        console.error('Erro fetch:', err);
      }
    }, 'image/png');
  });
});