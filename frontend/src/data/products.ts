import jacketImage from '../assets/imgs/erdalguda-6.jpg';
import shirtImage from '../assets/imgs/erdalguda-5.jpg';
import suitImage from '../assets/imgs/erdalguda-10.jpg';
import trouserImage from '../assets/imgs/erdalguda-7.jpg';
import vestImage from '../assets/imgs/erdalguda-8.jpg';
import tuxedoImage from '../assets/imgs/erdalguda-11.jpg';

export type Product = {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  image: string;
  features: string[];
};

export const products: Product[] = [
  {
    id: 'gomlek',
    title: 'Gömlek',
    shortDescription: 'Yaka, manşet, kol boyu ve kumaş seçimiyle kişiye özel gömlek.',
    longDescription:
      'Gömlek, müşterinin duruşuna, omuz yapısına ve günlük kullanım alışkanlığına göre hazırlanır. Yaka formu, manşet detayı, kol boyu ve kumaş dokusu birlikte değerlendirilir.',
    image: shirtImage,
    features: ['Kişiye özel yaka formu', 'Manşet ve kol boyu ayarı', 'Kumaş ve duruş dengesi'],
  },
  {
    id: 'ceket',
    title: 'Ceket',
    shortDescription: 'Omuz, göğüs, bel ve duruş dengesine göre şekillenen ceket.',
    longDescription:
      'Ceket kalıbı omuz hattı, göğüs rahatlığı, bel oturuşu ve hareket dengesi üzerinden kurulur. Amaç, vücuda yapışmayan fakat duruşu netleştiren rafine bir silüettir.',
    image: jacketImage,
    features: ['Omuz hattı kontrolü', 'Göğüs ve bel dengesi', 'Duruşa göre kalıp çalışması'],
  },
  {
    id: 'pantolon',
    title: 'Pantolon',
    shortDescription: 'Bel, kalça, paça ve kırılım detayları titizlikle ayarlanan pantolon.',
    longDescription:
      'Pantolon çalışmasında bel yüksekliği, kalça rahatlığı, paça genişliği ve ayakkabı üzerindeki kırılım birlikte ele alınır. Sonuç, hem konforlu hem temiz görünen bir hat sunar.',
    image: trouserImage,
    features: ['Bel ve kalça uyumu', 'Paça genişliği', 'Kırılım ve boy dengesi'],
  },
  {
    id: 'yelek',
    title: 'Yelek',
    shortDescription: 'Gövde hattı ve düğme yerleşimiyle takımı tamamlayan yapı.',
    longDescription:
      'Yelek, gövde hattını toparlayan ve takımın karakterini güçlendiren tamamlayıcı parçadır. Düğme yerleşimi, ön açıklık ve sırt rahatlığı ölçüyle planlanır.',
    image: vestImage,
    features: ['Gövde hattı dengesi', 'Düğme yerleşimi', 'Takım tamamlayıcı form'],
  },
  {
    id: 'takim-elbise',
    title: 'Takım Elbise',
    shortDescription: 'Ceket ve pantolon bütünlüğüyle özel dikim takım elbise.',
    longDescription:
      'Takım elbise süreci, ceket ve pantolonun aynı dilde konuşmasını hedefler. Kalıp uyumu, kumaş seçimi, prova notları ve son teslim detayları bütünlüklü şekilde yönetilir.',
    image: suitImage,
    features: ['Ceket-pantolon bütünlüğü', 'Kalıp uyumu', 'Özel dikim prova süreci'],
  },
  {
    id: 'smokin',
    title: 'Smokin',
    shortDescription: 'Davet ve gece etkinlikleri için sivri/şal yaka, ipek detaylı smokin.',
    longDescription:
      'Smokin, gece etiketinin gerektirdiği keskin siluet ile rahat hareket alanını dengeleyen özel bir terzilik çalışmasıdır. İpek satin yaka, kemerli pantolon ve geleneksel düğme yerleşimi, davet temasına göre kişiselleştirilir.',
    image: tuxedoImage,
    features: ['Sivri veya şal yaka', 'İpek satin yaka kaplaması', 'Kemerli pantolon ve kuşak detayı'],
  },
];
