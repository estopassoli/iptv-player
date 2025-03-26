## ✨ Aplicativo Next.js Multifacetado (Sugestão) ✨

Este projeto representa um aplicativo web de IPTV Player construído com Next.js, incorporando uma variedade de componentes, hooks, APIs e utilitários. A estrutura sugere um projeto bem organizado com recursos como roteamento de API, manipulação de vídeos, armazenamento IndexedDB e um conjunto abrangente de componentes de interface do usuário.

## 💻 Tecnologias Utilizadas

- Next.js
- TypeScript
- Tailwind CSS
- PostCSS
- React

## 📂 Arquitetura do Projeto

### 📁 app/

Contém a lógica principal do aplicativo, incluindo rotas de API, componentes de página e layout.

- `api/`: Rotas de API para lidar com solicitações do lado do servidor.
    - `fetch-m3u`: Rota para buscar e processar arquivos M3U.
    - `proxy-video`: Rota para proxy de vídeos.
    - `resolve-video-url`: Rota para resolver URLs de vídeo.
- `globals.css`: Estilos globais da aplicação.
- `layout.tsx`: Componente de layout para o aplicativo.
- `loading.tsx`: Componente exibido durante o carregamento.
- `page.tsx`: Componente da página principal.

### 📁 components/

Componentes de interface do usuário reutilizáveis.

- `iptv-content.tsx`: Componente para exibir conteúdo de IPTV.
- `search-bar.tsx`: Componente para realizar buscas.
- `theme-provider.tsx`: Provedor de temas para o aplicativo.
- `theme-toggle.tsx`: Componente para alternar entre temas.
- `ui/`: Subpasta com diversos componentes de interface do shadCN.
- `upload.tsx`: Componente para upload de arquivos.
- `video-player.tsx`: Componente para reprodução de vídeos.

### 📁 hooks/

Hooks personalizados para lógica reutilizável.

- `use-mobile.tsx`: Hook para detecção de dispositivos móveis.
- `use-toast.ts`: Hook para exibir notificações toast.

### 📁 lib/

Funções utilitárias e helpers.

- `idb-storage.ts`:  Utilitários para interação com o IndexedDB.
- `m3u-parser.ts`: Utilitário para analisar arquivos M3U.
- `thumbnail-manager.ts`:  Utilitário para gerenciar miniaturas.
- `utils.ts`: Utilitários gerais.

