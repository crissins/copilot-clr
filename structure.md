# Estructura del Proyecto

<!-- PROJECT_STRUCTURE_START -->
```
├── 📁 .github/
│   └── 📁 workflows/
│       ├── 📄 deploy-api.yml
│       ├── 📄 deploy-app.yml
│       └── 📄 deploy-infra.yml
├── 📁 backend/
│   ├── 📁 agents/
│   │   ├── 📄 chat_agent.py
│   │   ├── 📄 tools.py
│   │   └── 📄 __init__.py
│   ├── 📁 auth/
│   │   ├── 📄 entra.py
│   │   └── 📄 __init__.py
│   ├── 📄 Dockerfile
│   ├── 📄 function_app.py
│   ├── 📄 host.json
│   ├── 📄 main.py
│   └── 📄 requirements.txt
├── 📁 basic-chat/
│   ├── 📁 .azure/
│   │   ├── 📄 .gitignore
│   │   ├── 📄 .state-change
│   │   ├── 📄 config.json
│   │   └── 📁 hackathon-env-2/
│   │       ├── 📄 .env
│   │       └── 📄 config.json
│   ├── 📄 .dockerignore
│   ├── 📄 .env
│   ├── 📄 .gitignore
│   ├── 📁 app/
│   │   ├── 📄 Dockerfile
│   │   ├── 📄 foundry_client.py
│   │   ├── 📄 main.py
│   │   ├── 📄 models.py
│   │   ├── 📄 requirements.txt
│   │   └── 📁 __pycache__/
│   │       ├── 📄 foundry_client.cpython-313.pyc
│   │       ├── 📄 main.cpython-313.pyc
│   │       └── 📄 models.cpython-313.pyc
│   ├── 📄 azure.yaml
│   ├── 📄 ENV.md
│   ├── 📁 frontend/
│   │   ├── 📄 .env.production
│   │   ├── 📁 .github/
│   │   │   └── 📁 workflows/
│   │   │       └── 📄 azure-static-web-apps-salmon-wave-0a2721c0f.yml
│   │   ├── 📄 .gitignore
│   │   ├── 📄 eslint.config.js
│   │   ├── 📄 index.html
│   │   ├── 📄 package-lock.json
│   │   ├── 📄 package.json
│   │   ├── 📁 public/
│   │   │   ├── 📄 favicon.svg
│   │   │   └── 📄 icons.svg
│   │   ├── 📄 README.md
│   │   ├── 📁 src/
│   │   │   ├── 📁 app/
│   │   │   │   ├── 📄 App.styles.ts
│   │   │   │   └── 📄 App.tsx
│   │   │   ├── 📁 assets/
│   │   │   │   ├── 📄 hero.png
│   │   │   │   ├── 📄 react.svg
│   │   │   │   └── 📄 vite.svg
│   │   │   ├── 📁 components/
│   │   │   │   ├── 📄 AccessibilityPanel.tsx
│   │   │   │   ├── 📄 ChatMessage.tsx
│   │   │   │   ├── 📄 ChatWindow.tsx
│   │   │   │   ├── 📄 Composer.tsx
│   │   │   │   └── 📄 QuickActions.tsx
│   │   │   ├── 📄 index.css
│   │   │   └── 📄 main.tsx
│   │   ├── 📄 staticwebapp.config.json
│   │   ├── 📄 tsconfig.app.json
│   │   ├── 📄 tsconfig.json
│   │   ├── 📄 tsconfig.node.json
│   │   └── 📄 vite.config.ts
│   ├── 📁 infra/
│   │   └── 📄 main.bicep
│   ├── 📄 README.md
│   ├── 📁 scripts/
│   │   ├── 📄 create_agent.py
│   │   ├── 📄 deploy-model.sh
│   │   ├── 📄 set-secrets.sh
│   │   └── 📄 test_chat.py
│   └── 📄 structure.md
├── 📁 docs/
│   └── 📁 images/
│       ├── 📄 arch.drawio.png
│       └── 📄 what-is-an-agent.png
├── 📁 frontend/
│   ├── 📄 .env.example
│   ├── 📄 index.html
│   ├── 📄 package-lock.json
│   ├── 📄 package.json
│   ├── 📁 src/
│   │   ├── 📄 App.tsx
│   │   ├── 📁 auth/
│   │   │   └── 📄 msalConfig.ts
│   │   ├── 📁 components/
│   │   │   ├── 📄 Chat.tsx
│   │   │   ├── 📄 FileUpload.tsx
│   │   │   ├── 📄 ImmersiveReaderButton.tsx
│   │   │   ├── 📄 LoginButton.tsx
│   │   │   ├── 📄 MessageList.tsx
│   │   │   ├── 📄 PreferencesPanel.tsx
│   │   │   ├── 📄 ReportButton.tsx
│   │   │   ├── 📄 Sidebar.tsx
│   │   │   └── 📄 TTSButton.tsx
│   │   ├── 📁 features/
│   │   │   ├── 📁 feature1/
│   │   │   │   └── 📄 Feature1Page.tsx
│   │   │   ├── 📁 feature2/
│   │   │   │   └── 📄 Feature2Page.tsx
│   │   │   ├── 📁 feature3/
│   │   │   │   └── 📄 Feature3Page.tsx
│   │   │   ├── 📁 feature4/
│   │   │   │   └── 📄 Feature4Page.tsx
│   │   │   ├── 📁 feature5/
│   │   │   │   └── 📄 Feature5Page.tsx
│   │   │   └── 📁 feature6/
│   │   │       └── 📄 Feature6Page.tsx
│   │   ├── 📁 hooks/
│   │   │   └── 📄 useAuth.ts
│   │   ├── 📄 main.tsx
│   │   ├── 📁 services/
│   │   │   └── 📄 api.ts
│   │   ├── 📄 styles.css
│   │   └── 📄 vite-env.d.ts
│   ├── 📄 staticwebapp.config.json
│   ├── 📄 tsconfig.json
│   ├── 📄 tsconfig.tsbuildinfo
│   └── 📄 vite.config.ts
├── 📁 infra/
│   ├── 📄 main.bicep
│   ├── 📄 main.bicepparam
│   ├── 📄 main.dev.bicepparam
│   ├── 📄 main.lowcost.bicepparam
│   ├── 📁 modules/
│   │   ├── 📄 ai-foundry-hub.bicep
│   │   ├── 📄 ai-foundry-project.bicep
│   │   ├── 📄 appservice.bicep
│   │   ├── 📄 cognitiveservices.bicep
│   │   ├── 📄 communication.bicep
│   │   ├── 📄 container-apps.bicep
│   │   ├── 📄 container-registry.bicep
│   │   ├── 📄 cosmosdb.bicep
│   │   ├── 📄 document-intelligence.bicep
│   │   ├── 📄 event-grid.bicep
│   │   ├── 📄 functions.bicep
│   │   ├── 📄 immersive-reader.bicep
│   │   ├── 📄 keyvault.bicep
│   │   ├── 📄 monitoring.bicep
│   │   ├── 📄 openai.bicep
│   │   ├── 📄 search.bicep
│   │   ├── 📄 security.bicep
│   │   ├── 📄 servicebus.bicep
│   │   ├── 📄 speech.bicep
│   │   ├── 📄 staticwebapp.bicep
│   │   └── 📄 storage.bicep
│   └── 📁 scripts/
│       ├── 📄 deploy-dev.sh
│       ├── 📄 deploy-lowcost.sh
│       └── 📄 deploy.sh
├── 📁 propuesta-arch/
│   ├── 📄 01_ESPECIFICACION_MARKDOWN.md
│   ├── 📄 02_PLAN_IMPLEMENTACION_MARKDOWN.md
│   ├── 📄 arquitectura.md
│   ├── 📄 BICEP_QUICK_START.md
│   ├── 📄 deploy.sh
│   ├── 📄 diagrama.jpeg
│   ├── 📄 main.bicep
│   └── 📄 parameters.dev.json
└── 📄 structure.md
```
<!-- PROJECT_STRUCTURE_END -->
