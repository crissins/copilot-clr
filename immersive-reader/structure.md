# Estructura del Proyecto

<!-- PROJECT_STRUCTURE_START -->
```
├── 📁 .azure/
│   ├── 📄 .gitignore
│   ├── 📄 .state-change
│   ├── 📄 config.json
│   └── 📁 dev/
│       ├── 📄 .env
│       └── 📄 config.json
├── 📄 .env
├── 📁 app/
│   ├── 📁 api/
│   │   ├── 📄 accessibility.py
│   │   ├── 📄 immersive_reader.py
│   │   ├── 📄 simplify.py
│   │   └── 📄 __init__.py
│   ├── 📁 core/
│   │   ├── 📄 config.py
│   │   └── 📄 __init__.py
│   ├── 📄 Dockerfile
│   ├── 📄 main.py
│   ├── 📁 models/
│   │   ├── 📄 accessibility_models.py
│   │   ├── 📄 immersive_reader_models.py
│   │   ├── 📄 simplify_models.py
│   │   └── 📄 __init__.py
│   ├── 📄 requirements.txt
│   └── 📁 services/
│       ├── 📄 foundry_service.py
│       ├── 📄 immersive_reader_service.py
│       ├── 📄 simplifier_service.py
│       └── 📄 __init__.py
├── 📄 azure.yaml
├── 📄 docker-compose.yml
├── 📁 frontend/
│   ├── 📄 .gitignore
│   ├── 📄 eslint.config.js
│   ├── 📄 index.html
│   ├── 📄 package-lock.json
│   ├── 📄 package.json
│   ├── 📁 public/
│   │   ├── 📄 favicon.svg
│   │   └── 📄 icons.svg
│   ├── 📄 README.md
│   ├── 📁 src/
│   │   ├── 📄 App.css
│   │   ├── 📄 App.tsx
│   │   ├── 📁 assets/
│   │   │   ├── 📄 hero.png
│   │   │   ├── 📄 react.svg
│   │   │   └── 📄 vite.svg
│   │   ├── 📄 index.css
│   │   └── 📄 main.tsx
│   ├── 📄 tsconfig.app.json
│   ├── 📄 tsconfig.json
│   ├── 📄 tsconfig.node.json
│   └── 📄 vite.config.ts
├── 📁 infra/
│   ├── 📄 foundry.bicep
│   ├── 📄 main.bicep
│   ├── 📄 main.parameter.json
│   └── 📁 modules/
│       ├── 📄 foundry-account.bicep
│       ├── 📄 foundry-model-deployment.bicep
│       ├── 📄 foundry-project.bicep
│       ├── 📄 immersive-reader.bicep
│       └── 📄 outputs.bicep
├── 📄 README.md
├── 📁 scripts/
│   ├── 📄 create_agent.py
│   ├── 📄 create_immersive_reader_entra.sh
│   ├── 📄 deploy-model.sh
│   └── 📄 set-secrets.sh
└── 📄 structure.md
```
<!-- PROJECT_STRUCTURE_END -->
