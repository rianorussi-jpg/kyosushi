const img = name => `/assets/menu/${name}.jpg`
let id = 1
const item = (name, category, price, desc, image, extra={}) => ({ id:id++, name, category, price, desc, image:img(image), ...extra })

export const categories = [
  'Favoritos','Entradas','Kushiagues','Sopas','Ramen','Poke Bowl','Rollos','Arroz','Postres'
]

export const products = [
  item('Edamames','Entradas',98,'150 g · Al vapor, asados con mantequilla y soya o spicy lemon.','edamames',{featured:true}),
  item('Spring Rolls','Entradas',92,'4 piezas · Rellenos de vegetales, acompañados de salsa agridulce.','spring-rolls',{featured:true}),
  item('Gyozas de cerdo','Entradas',104,'5 piezas · Empanadillas fritas de cerdo con vegetales, acompañadas de salsa spicy ponzu.','gyozas'),
  item('Camarones Rokka','Entradas',168,'Trozos de camarón tempura bañados en mayo chipotle, cebollín y aguacate sobre cama de ensalada.','rokka',{featured:true,spicy:true}),
  item('Chicken Karaague','Entradas',112,'Bocados crujientes de pechuga marinada en soya, ajo y jengibre, con mayo chipotle y limón.','karaague'),
  item('Tempura de verduras','Entradas',116,'4 piezas · Verduras de temporada tempurizadas.','tempura-verduras'),

  item('Kushiague de queso manchego','Kushiagues',106,'2 piezas · Brochetas empanizadas acompañadas de salsa kushiague.','kushi-queso'),
  item('Misoshiro','Sopas',78,'225 ml · Fondo miso, fideo harusame, alga wakame, cebollín y tofu.','misoshiro'),

  item('Pork Belly Ramen','Ramen',206,'Pasta ramen, pork belly teriyaki, naruto, col blanca, cebollín, zanahoria, huevo, espinaca, nori y fondo tonkotsu.','pork-belly-ramen',{featured:true}),
  item('Tantan Ramen','Ramen',218,'Pasta ramen, carne de cerdo picante, chile tempura, huevo, espinaca, ajonjolí y fondo tonkotsu.','tantan-ramen',{spicy:true}),
  item('Ebi Crispy Ramen','Ramen',236,'Pasta ramen, camarones crujientes, cebollín, huevo, jitomate deshidratado, chilli oil y fondo tonkotsu.','ebi-crispy-ramen',{featured:true,spicy:true}),

  item('Sunset','Poke Bowl',196,'320 g · Salmón fresco, atún, pescado blanco, aguacate, cebollín y mayo sriracha.','sunset'),
  item('Tokio Bacon','Poke Bowl',186,'320 g · Salmón, tocino ahumado, aguacate, queso fila, pepino, cebollín y mayo habanero.','tokio-bacon'),
  item('Samurai','Poke Bowl',182,'320 g · Camarones rokka, mango, col morada, aguacate, cebollín, mayo teriyaki y mayo chipotle.','samurai'),

  item('Spicy Tuna Roll','Rollos',154,'10 piezas · Tempurizado con nori, salsa de anguila y cebollín; aguacate y atún spicy.','spicy-tuna-roll',{featured:true,spicy:true}),
  item('Tampico Roll','Rollos',148,'10 piezas · Empanizado, tampico y salsa kushiague; aguacate y pepino.','tampico-roll'),
  item('Philly Roll','Rollos',162,'10 piezas · Empanizado y salsa de anguila; salmón, pepino y queso.','philly-roll'),
  item('Crunch Roll','Rollos',172,'10 piezas · Salmón fresco, mayo chipotle y cebollín; kakiage de verduras, queso crema y aguacate.','crunch-roll'),

  item('Gohan Kyo','Arroz',108,'320 g · Arroz gohan, tampico, aguacate, mango, kanikama tempura, mayo chipotle y salsa de anguila.','gohan-kyo'),
  item('Cheese Cake Japonés','Postres',126,'Individual · Acompañado de helado de vainilla y salsa de frutos rojos.','cheesecake-japones')
]

export const branches = [
  {id:'zakia',name:'KYO Zákia',short:'Zákia',address:'Plaza UNITY, local 103 PB, Zákia.',phone:'442 890 3797',eta:'35–50 min'},
  {id:'milenio',name:'KYO Milenio',short:'Milenio',address:'Plaza UBIKA Milenio, local 112, Milenio III.',phone:'442 283 4928',eta:'35–50 min'}
]
