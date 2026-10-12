-- Dhanvika: full menu (20 veg + 20 non-veg).
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: the column is only added if missing, and each dish is only
-- inserted if a dish with the same name doesn't already exist.

-- ---------- 1. Veg / non-veg flag ----------
alter table menu_items add column if not exists is_veg boolean not null default true;

-- The four original sample dishes are all vegetarian; group biryani with rice dishes.
update menu_items set category = 'Biryani & Rice' where name = 'Veg Biryani';

-- ---------- 2. Menu items (prices in ₹) ----------
insert into menu_items (name, category, description, price, is_veg)
select seed.name, seed.category, seed.description, seed.price, seed.is_veg
from (values
  -- Veg starters
  ('Gobi Manchurian',        'Starters',       'Crispy cauliflower tossed in spicy Indo-Chinese sauce',      160, true),
  ('Veg Spring Rolls',       'Starters',       'Golden rolls stuffed with seasoned vegetables',              150, true),
  ('Chilli Paneer',          'Starters',       'Paneer cubes with peppers, onion and green chilli',          210, true),
  ('Crispy Corn',            'Starters',       'Fried sweet corn with pepper and spices',                    170, true),
  -- Veg main course
  ('Paneer Butter Masala',   'Main Course',    'Paneer in a rich, creamy tomato and butter gravy',           240, true),
  ('Kadai Paneer',           'Main Course',    'Paneer cooked with capsicum and freshly ground kadai masala', 240, true),
  ('Palak Paneer',           'Main Course',    'Cottage cheese in a smooth spinach gravy',                   230, true),
  ('Dal Tadka',              'Main Course',    'Yellow lentils tempered with ghee, garlic and cumin',        160, true),
  ('Mixed Veg Curry',        'Main Course',    'Seasonal vegetables in a home-style onion tomato gravy',     180, true),
  -- Veg biryani & rice
  ('Paneer Biryani',         'Biryani & Rice', 'Dum-cooked basmati rice layered with spiced paneer',         250, true),
  ('Veg Fried Rice',         'Biryani & Rice', 'Wok-tossed rice with fresh vegetables',                      160, true),
  ('Jeera Rice',             'Biryani & Rice', 'Basmati rice tempered with cumin and ghee',                  130, true),
  ('Curd Rice',              'Biryani & Rice', 'Soft rice with fresh curd, tempered with mustard and curry leaves', 110, true),
  -- Veg breads & desserts
  ('Tandoori Roti',          'Breads',         'Whole wheat bread from the tandoor',                          30, true),
  ('Garlic Naan',            'Breads',         'Naan topped with garlic and coriander',                       70, true),
  ('Double Ka Meetha',       'Desserts',       'Hyderabadi bread pudding with saffron and dry fruits',       130, true),
  -- Non-veg starters
  ('Chicken 65',             'Starters',       'Spicy deep-fried chicken with curry leaves and chilli',      220, false),
  ('Chilli Chicken',         'Starters',       'Crispy chicken tossed with peppers in chilli sauce',         230, false),
  ('Chicken Lollipop',       'Starters',       'Frenched chicken wings, fried crisp, with schezwan dip',     240, false),
  ('Chicken Tikka',          'Starters',       'Boneless chicken marinated in yoghurt and spices, chargrilled', 260, false),
  ('Tandoori Chicken (Half)','Starters',       'Half chicken roasted in the tandoor',                        280, false),
  ('Apollo Fish',            'Starters',       'Andhra-style spicy fried fish with green chilli',            290, false),
  ('Prawns Fry',             'Starters',       'Prawns pan-fried with pepper and Andhra spices',             340, false),
  -- Non-veg main course
  ('Egg Masala',             'Main Course',    'Boiled eggs in a spicy onion tomato masala',                 180, false),
  ('Andhra Chicken Curry',   'Main Course',    'Home-style spicy chicken curry',                             260, false),
  ('Butter Chicken',         'Main Course',    'Tandoori chicken in a creamy tomato and butter gravy',       290, false),
  ('Kadai Chicken',          'Main Course',    'Chicken with capsicum and kadai masala',                     280, false),
  ('Fish Curry',             'Main Course',    'Fish simmered in a tangy tamarind gravy',                    300, false),
  ('Mutton Rogan Josh',      'Main Course',    'Slow-cooked mutton in a Kashmiri chilli gravy',              380, false),
  ('Gongura Mutton',         'Main Course',    'Tender mutton cooked with tangy gongura leaves',             390, false),
  -- Non-veg biryani & rice
  ('Egg Biryani',            'Biryani & Rice', 'Dum biryani with masala-fried boiled eggs',                  200, false),
  ('Chicken Fried Rice',     'Biryani & Rice', 'Wok-tossed rice with chicken, egg and vegetables',           200, false),
  ('Chicken Dum Biryani',    'Biryani & Rice', 'Hyderabadi dum biryani with tender chicken',                 260, false),
  ('Chicken Fry Piece Biryani','Biryani & Rice','Biryani rice served with spicy fried chicken pieces',       280, false),
  ('Prawns Biryani',         'Biryani & Rice', 'Basmati rice dum-cooked with spiced prawns',                 340, false),
  ('Mutton Biryani',         'Biryani & Rice', 'Dum biryani with slow-cooked tender mutton',                 360, false)
) as seed(name, category, description, price, is_veg)
where not exists (select 1 from menu_items m where m.name = seed.name);
