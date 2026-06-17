## Cómo ejecutarlo

Primero activa tu entorno virtual e instala dependencias desde `backend/requirements.txt`.

🟢 En macOS / Linux / Git Bash

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

🔵 En Windows (PowerShell)

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate
pip install -r requirements.txt
```

Verificar que todo quedó bien

Después de instalar, ejecuta:

```bash
pip list
```

Debes ver algo como:
- azure-ai-projects
- azure-identity
- fastapi

---

Luego, desde la raíz del proyecto:

```bash
az login
azd auth login
```

Después carga variables del entorno de `azd` en tu sesión.

### En Git Bash / Linux / macOS

```bash
eval "$(azd env get-values)"
python scripts/test_chat.py
```

### En PowerShell

Si `azd env get-values` no te queda directo como variables de sesión, puedes correr el script después de haber ejecutado `azd up` y asegurarte de tener estas variables disponibles:

* `FOUNDRY_PROJECT_ENDPOINT`
* `MODEL_DEPLOYMENT_NAME`
* `AGENT_NAME`

Una forma simple es ponerlas en un `.env` y cargarlas con `python-dotenv`, pero con tu setup actual lo más limpio es usar las variables de `azd`.

## Qué deberías ver

Algo así:

```text
Using agent: base-chat-agent
Creating conversation...
Conversation created: conv_abc123
Type 'exit' to quit.

You: I feel overwhelmed with my tasks today.

Assistant: I’m sorry you’re feeling that way. Let’s make this easier by taking it one step at a time...
```

## Pruebas que te recomiendo hacer

### 1. Respuesta básica

Escribe:

```text
I feel overwhelmed with my tasks today.
```

Debes recibir una respuesta calmada, clara y supportive.

### 2. Multi-turn

Luego escribe:

```text
Can you break that into 3 smaller steps?
```

Si todo está bien, el agente debe mantener el contexto de la conversación anterior.

### 3. Tono

Prueba algo como:

```text
I'm confused and don't know where to start.
```

Debe responder con tono tranquilizador, no brusco ni demasiado técnico.

## Si falla, revisa esto

### Error de autenticación

Haz:

```bash
az login
```

### No encuentra el endpoint del project

Verifica que exista:

```bash
azd env get-values
```

Y que incluya `FOUNDRY_PROJECT_ENDPOINT`.

### El agente no existe

Vuelve a correr:

```bash
python scripts/create_agent.py
```

### El modelo no existe

Vuelve a correr:

```bash
sh scripts/deploy-model.sh
```

## Siguiente paso ideal

Cuando este script funcione, ya puedes pasar a FastAPI con mucha más confianza, porque el problema de infraestructura/agente ya quedó validado.
