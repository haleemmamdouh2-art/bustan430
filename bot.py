import os
import logging
import asyncio
from datetime import datetime
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
PHOTO, TITLE, LOCATION, NOTE, FLOWER = range(5)

FLOWER_MAP = {
    'rose': '🌹 Rose',
    'tulip': '🌷 Tulip',
    'sunflower': '🌻 Sunflower',
    'lily': '🪷 Lily',
    'daisy': '🌼 Daisy'
}

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Welcome to Bustan's Journal Bot! 🌹\n\n"
        "I can help you plant memories directly from Telegram.\n"
        "Commands:\n"
        "/add - Plant a new memory\n"
        "/list - View recent memories\n"
        "/cancel - Stop current action"
    )

async def add_memory_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    context.user_data['photos'] = []
    await update.message.reply_text("Please send the photo(s) for this memory. When you're done, send /done.")
    return PHOTO

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    photo_file = await update.message.photo[-1].get_file()
    # Store file_id to download later
    context.user_data['photos'].append(photo_file)
    await update.message.reply_text(f"Photo added! Total: {len(context.user_data['photos'])}. Send more or /done.")
    return PHOTO

async def photo_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.user_data.get('photos'):
        await update.message.reply_text("Please send at least one photo!")
        return PHOTO
    await update.message.reply_text("Got the photos! Now, what's the **Title** for this memory?")
    return TITLE

async def handle_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['title'] = update.message.text
    await update.message.reply_text("Nice! Now, where was this taken? (**Location**)")
    return LOCATION

async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['location'] = update.message.text
    await update.message.reply_text("And the **Note** or story for this memory?")
    return NOTE

async def handle_note(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['note'] = update.message.text
    
    keyboard = [
        [InlineKeyboardButton(v, callback_data=k)] for k, v in FLOWER_MAP.items()
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("Finally, choose a **Flower Tag**:", reply_markup=reply_markup)
    return FLOWER

async def handle_flower(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data['flower_type'] = query.data
    
    await query.edit_message_text("Planting your memory in the garden... ⏳")
    
    try:
        # Upload photos to Supabase Storage
        uploaded_urls = []
        for i, photo_file in enumerate(context.user_data['photos']):
            # Download file from Telegram
            file_bytes = await photo_file.download_as_bytearray()
            
            ext = photo_file.file_path.split('.')[-1]
            filename = f"tg_{int(datetime.now().timestamp())}_{i}.{ext}"
            
            # Upload to 'memories' bucket
            res = supabase.storage.from_("memories").upload(
                path=filename,
                file=bytes(file_bytes),
                file_options={"content-type": f"image/{ext}"}
            )
            
            # Get public URL
            url_res = supabase.storage.from_("memories").get_public_url(filename)
            uploaded_urls.append(url_res)

        # Insert into Database
        memory_data = {
            "photos": uploaded_urls,
            "photo": uploaded_urls[0] if uploaded_urls else "",
            "title": context.user_data['title'],
            "location": context.user_data['location'],
            "note": context.user_data['note'],
            "flower_type": context.user_data['flower_type'],
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        
        supabase.table("memories").insert(memory_data).execute()
        
        await query.message.reply_text("Memory successfully planted! 🌹✨ Check the site!")
        return ConversationHandler.END

    except Exception as e:
        logging.error(f"Error planting memory: {e}")
        await query.message.reply_text(f"Oops! Something went wrong: {e}")
        return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Action cancelled.")
    return ConversationHandler.END

async def list_memories(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        res = supabase.table("memories").select("*").order("date", desc=True).limit(5).execute()
        mems = res.data
        
        if not mems:
            await update.message.reply_text("The garden is currently empty.")
            return
            
        text = "🌸 **Recent Memories:**\n\n"
        for m in mems:
            text += f"📅 {m['date']} - **{m['title']}**\n📍 {m['location']}\n\n"
        
        await update.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        await update.message.reply_text(f"Error fetching memories: {e}")

if __name__ == '__main__':
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('add', add_memory_start)],
        states={
            PHOTO: [
                MessageHandler(filters.PHOTO, handle_photo),
                CommandHandler('done', photo_done)
            ],
            TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_title)],
            LOCATION: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_location)],
            NOTE: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_note)],
            FLOWER: [CallbackQueryHandler(handle_flower)],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
    )
    
    app.add_handler(CommandHandler('start', start))
    app.add_handler(CommandHandler('list', list_memories))
    app.add_handler(conv_handler)
    
    print("Bot is blooming...")
    app.run_polling()
