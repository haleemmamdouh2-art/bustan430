import os
import logging
import asyncio
import calendar
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
    ConversationHandler,
    CallbackQueryHandler
)
from supabase import create_client, Client

# Supabase Credentials
SUPABASE_URL = "https://byqfgirtizfvbmvrkuts.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5cWZnaXJ0aXpmdmJtdnJrdXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjE0MjksImV4cCI6MjA5Mjg5NzQyOX0.KIh1RSlwO0ps4vT4tFBvB4qiamCxLyLhCtUvaVnYUvY"
TELEGRAM_TOKEN = "8556636256:AAH5uQ29DrY9zrEzrrKnj5fU_El-uQ5Ea7U"

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)

# States
MAIN_MENU, GET_INPUT = range(2)

FLOWER_MAP = {
    'rose': '🌹 Rose',
    'tulip': '🌷 Tulip',
    'sunflower': '🌻 Sunflower',
    'lily': '🪷 Lily',
    'daisy': '🌼 Daisy'
}

def create_calendar(year=None, month=None):
    now = datetime.now()
    if year is None: year = now.year
    if month is None: month = now.month
    
    # Header: Month and Year
    keyboard = [
        [InlineKeyboardButton(f"{calendar.month_name[month]} {year}", callback_data="ignore")],
        [InlineKeyboardButton(day, callback_data="ignore") for day in ["M", "T", "W", "T", "F", "S", "S"]]
    ]
    
    # Days
    month_calendar = calendar.monthcalendar(year, month)
    for week in month_calendar:
        row = []
        for day in week:
            if day == 0:
                row.append(InlineKeyboardButton(" ", callback_data="ignore"))
            else:
                row.append(InlineKeyboardButton(str(day), callback_data=f"date_{year}_{month}_{day}"))
        keyboard.append(row)
        
    # Navigation
    nav_row = [
        InlineKeyboardButton("❮ Prev", callback_data=f"cal_{year if month > 1 else year-1}_{month-1 if month > 1 else 12}"),
        InlineKeyboardButton("Next ❯", callback_data=f"cal_{year if month < 12 else year+1}_{month+1 if month < 12 else 1}")
    ]
    keyboard.append(nav_row)
    keyboard.append([InlineKeyboardButton("🔙 Back to Draft", callback_data="back_to_menu")])
    
    return InlineKeyboardMarkup(keyboard)

def get_draft_keyboard(data):
    """Generates the main interactive menu for the memory draft"""
    title = data.get('title', 'Not set')
    loc = data.get('location', 'Not set')
    note = data.get('note', 'Not set')
    date = data.get('date', datetime.now().strftime("%Y-%m-%d"))
    flower = FLOWER_MAP.get(data.get('flower_type', 'rose'), '🌹 Rose')
    
    keyboard = [
        [InlineKeyboardButton(f"📅 Date: {date}", callback_data="set_date")],
        [InlineKeyboardButton(f"📝 Title: {title[:20]}...", callback_data="set_title")],
        [InlineKeyboardButton(f"📍 Location: {loc[:20]}...", callback_data="set_loc")],
        [InlineKeyboardButton(f"📖 Story: {note[:20]}...", callback_data="set_note")],
        [InlineKeyboardButton(f"🌸 Flower: {flower}", callback_data="set_flower")],
        [InlineKeyboardButton("✅ Plant Memory in Garden", callback_data="plant_now")]
    ]
    return InlineKeyboardMarkup(keyboard)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Welcome to Bustan's Journal Bot! 🌹\n\n"
        "Send me some photos to start planting a new memory.\n"
        "I'll build a draft for you that you can edit easily with buttons!"
    )

async def handle_photos_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if 'draft' not in context.user_data:
        context.user_data['draft'] = {
            'photos': [],
            'title': 'New Memory',
            'location': 'Cairo, Egypt',
            'note': 'A beautiful moment captured.',
            'flower_type': 'rose',
            'date': datetime.now().strftime("%Y-%m-%d")
        }
    
    photo_file = await update.message.photo[-1].get_file()
    context.user_data['draft']['photos'].append(photo_file)
    
    count = len(context.user_data['draft']['photos'])
    msg = f"📸 {count} Photo(s) received!\n\nUse the buttons below to customize your memory."
    
    reply_markup = get_draft_keyboard(context.user_data['draft'])
    await update.message.reply_text(msg, reply_markup=reply_markup)
    return MAIN_MENU

async def menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    action = query.data
    if action == "ignore": return MAIN_MENU
    
    if action == "plant_now":
        return await plant_memory_final(query, context)
        
    if action == "back_to_menu":
        await query.edit_message_text("Draft updated! Back to menu...", reply_markup=get_draft_keyboard(context.user_data['draft']))
        return MAIN_MENU

    if action == "set_date":
        await query.edit_message_text("Pick the date for this memory:", reply_markup=create_calendar())
        return MAIN_MENU

    if action.startswith("cal_"):
        _, year, month = action.split('_')
        await query.edit_message_text("Pick the date for this memory:", reply_markup=create_calendar(int(year), int(month)))
        return MAIN_MENU

    if action.startswith("date_"):
        _, y, m, d = action.split('_')
        selected_date = f"{y}-{int(m):02d}-{int(d):02d}"
        context.user_data['draft']['date'] = selected_date
        await query.edit_message_text(f"Date set to {selected_date}! Back to draft...", reply_markup=get_draft_keyboard(context.user_data['draft']))
        return MAIN_MENU

    if action == "set_flower":
        keyboard = [[InlineKeyboardButton(v, callback_data=f"flower_{k}")] for k, v in FLOWER_MAP.items()]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("Pick a flower tag for this memory:", reply_markup=reply_markup)
        return MAIN_MENU

    if action.startswith("flower_"):
        context.user_data['draft']['flower_type'] = action.replace("flower_", "")
        await query.edit_message_text("Flower updated! Back to draft...", reply_markup=get_draft_keyboard(context.user_data['draft']))
        return MAIN_MENU

    # For text inputs
    prompt_map = {
        "set_title": "Send me the **Title** for this memory:",
        "set_loc": "Send me the **Location** (e.g. Cairo, Egypt):",
        "set_note": "Send me the **Story/Note** for this memory:"
    }
    
    context.user_data['current_field'] = action
    await query.edit_message_text(prompt_map[action], parse_mode='Markdown')
    return GET_INPUT

async def handle_input_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    field = context.user_data.get('current_field')
    text = update.message.text
    
    field_map = {
        "set_title": "title",
        "set_loc": "location",
        "set_note": "note"
    }
    
    context.user_data['draft'][field_map[field]] = text
    reply_markup = get_draft_keyboard(context.user_data['draft'])
    await update.message.reply_text("Field updated! 📝", reply_markup=reply_markup)
    return MAIN_MENU

async def plant_memory_final(query, context):
    draft = context.user_data['draft']
    await query.edit_message_text("Planting your memory in the garden... ⏳")
    
    try:
        uploaded_urls = []
        for i, photo_file in enumerate(draft['photos']):
            file_bytes = await photo_file.download_as_bytearray()
            ext = photo_file.file_path.split('.')[-1]
            filename = f"tg_{int(datetime.now().timestamp())}_{i}.{ext}"
            
            supabase.storage.from_("memories").upload(path=filename, file=bytes(file_bytes), file_options={"content-type": f"image/{ext}"})
            url_res = supabase.storage.from_("memories").get_public_url(filename)
            uploaded_urls.append(url_res)

        memory_data = {
            "photos": uploaded_urls,
            "photo": uploaded_urls[0] if uploaded_urls else "",
            "title": draft['title'],
            "location": draft['location'],
            "note": draft['note'],
            "flower_type": draft['flower_type'],
            "date": draft['date']
        }
        
        supabase.table("memories").insert(memory_data).execute()
        await query.message.reply_text("Memory successfully planted! 🌹✨ Check the site!")
        context.user_data.clear()
        return ConversationHandler.END

    except Exception as e:
        logging.error(f"Error planting memory: {e}")
        await query.message.reply_text(f"Oops! Something went wrong: {e}")
        return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("Action cancelled. Send photos to start again.")
    return ConversationHandler.END

if __name__ == '__main__':
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    conv_handler = ConversationHandler(
        entry_points=[MessageHandler(filters.PHOTO, handle_photos_start)],
        states={
            MAIN_MENU: [CallbackQueryHandler(menu_callback)],
            GET_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_input_text)],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
        allow_reentry=True
    )
    app.add_handler(CommandHandler('start', start))
    app.add_handler(conv_handler)
    print("Bot is blooming...")
    app.run_polling()
