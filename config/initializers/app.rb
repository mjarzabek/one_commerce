# Nazwa produktu w jednym miejscu - podmień po wyborze marki (lub ustaw APP_NAME).
Rails.application.config.x.app_name = ENV.fetch("APP_NAME", "Nazwa")
