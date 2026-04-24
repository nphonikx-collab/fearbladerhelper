# FunPay Auto-Raise — GitHub Actions

Поднимает лоты на FunPay каждые 4 часа. Бесплатно, без VPS, без карты.
Работает даже когда комп выключен — GitHub запускает на своих серверах.

---

## Установка (5 минут)

### 1. Создай репозиторий

- github.com → **New repository**
- Название: `funpay-raiser`
- Тип: **Private** (чтобы токены не светились)
- **Create repository**

### 2. Загрузи файлы

Загрузи оба файла в репозиторий:
- `raise.js`
- `.github/workflows/raise.yml`

**Add file → Upload files**

> Папку `.github/workflows/` создай вручную или укажи полный путь при загрузке

### 3. Добавь секреты

**Settings → Secrets and variables → Actions → New repository secret**

| Секрет | Значение | Обязательно |
|---|---|---|
| `GOLDEN_KEY` | golden_key с FunPay | ✅ |
| `NODE_IDS` | `436` или `436,628` | ✅ |
| `TG_TOKEN` | Токен Telegram бота | ❌ |
| `TG_CHAT_ID` | Твой chat_id | ❌ |

### Где взять GOLDEN_KEY

1. Зайди на funpay.com в браузере
2. F12 → Application → Cookies → funpay.com
3. Найди `golden_key` → скопируй значение

### Где взять NODE_IDS

URL категории: `funpay.com/lots/**436**/trade` → `436`

---

## Ручной запуск

**Actions → FunPay Auto-Raise → Run workflow**

---

## Расписание

Каждые 4 часа: 01:01, 05:01, 09:01, 13:01, 17:01, 21:01 UTC

---

## Логи

**Actions** → выбери запуск → **raise** → смотри вывод

---

## Обновление golden_key

Когда FunPay обновит куку — зайди в **Settings → Secrets** и обнови `GOLDEN_KEY`.
