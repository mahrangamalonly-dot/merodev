import { uid } from './db.js';

const cat = (name, color) => ({ id: uid('cat'), name, color });

export function seed() {
  const drinks = cat('مشروبات', '#a855f7');
  const food = cat('مأكولات', '#e879f9');
  const sweets = cat('حلويات', '#38bdf8');
  const retail = cat('بقالة', '#34d399');

  const p = (name, catId, price, cost, stock, barcode, unit = 'قطعة') => ({
    id: uid('prd'),
    name,
    categoryId: catId,
    price,
    cost,
    stock,
    barcode,
    unit,
    active: true,
    createdAt: Date.now()
  });

  const products = [
    p('قهوة مختصة', drinks.id, 14, 5, 120, '100001'),
    p('لاتيه مثلج', drinks.id, 17, 6, 90, '100002'),
    p('عصير برتقال طبيعي', drinks.id, 12, 4, 60, '100003'),
    p('مشروب غازي', drinks.id, 5, 2, 200, '100004'),
    p('مياه معدنية', drinks.id, 2, 1, 300, '100005', 'عبوة'),
    p('شاي أخضر', drinks.id, 6, 2, 80, '100006'),
    p('برجر لحم', food.id, 32, 14, 40, '200001'),
    p('برجر دجاج', food.id, 26, 11, 45, '200002'),
    p('بيتزا مارغريتا', food.id, 38, 16, 20, '200003'),
    p('شاورما عربي', food.id, 22, 9, 35, '200004'),
    p('بطاطس مقلية', food.id, 10, 3, 100, '200005'),
    p('سلطة سيزر', food.id, 21, 8, 25, '200006'),
    p('كيك شوكولاتة', sweets.id, 15, 5, 30, '300001'),
    p('دونات سكر', sweets.id, 7, 2, 60, '300002'),
    p('آيس كريم', sweets.id, 9, 3, 45, '300003'),
    p('أرز بسمتي 1ك', retail.id, 24, 15, 50, '400001', 'كيس'),
    p('زيت زيتون 750مل', retail.id, 46, 32, 25, '400002', 'زجاجة'),
    p('سكر 2ك', retail.id, 12, 8, 70, '400003', 'كيس'),
    p('شاي أسود 200غ', retail.id, 18, 11, 40, '400004'),
    p('معجون طماطم', retail.id, 6, 3, 90, '400005', 'علبة')
  ];

  return {
    categories: [drinks, food, sweets, retail],
    products,
    users: [
      { id: uid('usr'), name: 'مدير النظام', username: 'admin', pin: '1234', role: 'admin', active: true },
      { id: uid('usr'), name: 'أحمد (كاشير)', username: 'cashier', pin: '1111', role: 'cashier', active: true }
    ],
    sales: [],
    held: [],
    counter: 1000
  };
}
