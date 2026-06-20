package com.erdalguda.tailor.config;

import com.erdalguda.tailor.entity.BlogPost;
import com.erdalguda.tailor.entity.Employee;
import com.erdalguda.tailor.entity.ProductionStage;
import com.erdalguda.tailor.entity.User;
import com.erdalguda.tailor.entity.UserRole;
import com.erdalguda.tailor.repository.BlogPostRepository;
import com.erdalguda.tailor.repository.EmployeeRepository;
import com.erdalguda.tailor.repository.ProductionStageRepository;
import com.erdalguda.tailor.repository.UserRepository;
import com.erdalguda.tailor.service.FabricService;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final String DEFAULT_SEEDED_PASSWORD = "erdalguda123";
    private static final String LOCAL_EMAIL_DOMAIN = "@erdalguda.local";

    private final EmployeeRepository employeeRepository;
    private final ProductionStageRepository productionStageRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;
    private final FabricService fabricService;
    private final BlogPostRepository blogPostRepository;

    public DataInitializer(
        EmployeeRepository employeeRepository,
        ProductionStageRepository productionStageRepository,
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        JdbcTemplate jdbcTemplate,
        FabricService fabricService,
        BlogPostRepository blogPostRepository
    ) {
        this.employeeRepository = employeeRepository;
        this.productionStageRepository = productionStageRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
        this.fabricService = fabricService;
        this.blogPostRepository = blogPostRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        applyCompatibilityFixes();
        Map<String, Employee> employees = seedEmployeesIfNeeded();
        seedProductionStagesIfNeeded(employees);
        seedUsersIfNeeded(employees);
        seedBlogPostsIfNeeded();
        // fabricService.seedDefaultFabric(); // Geçici olarak devre dışı — fabric sistemi sıfırlanıyor, "2191" otomatik geri gelmesin.
    }

    private void seedBlogPostsIfNeeded() {
        List<BlogPostSeed> seeds = List.of(
            new BlogPostSeed(
                "kumas-muhendisligi-super-130s",
                "Kumaş Mühendisliği: Super 130s ve İplik Numarasının Düşüş Hattındaki Etkisi",
                "Kumaş Mühendisliği",
                "Yünlü kumaşta Super değeri sadece pazarlama etiketi değil — iplik inceliğinin ölçüsüdür ve ceketin omuzdan eteğe kadar nasıl döküleceğini doğrudan belirler.",
                String.join("\n\n",
                    "Yünün dünyasında 'Super 100s', 'Super 130s' veya 'Super 180s' gibi etiketleri sık görürsünüz. Bu rakam, ham yün lifinin mikrondan inceliğini ölçen IWTO standardının görünür yüzüdür: lif ne kadar inceyse iplik o kadar yumuşak, parlak ve hassastır.",
                    "Pratikte Super 130s, 18.5 mikron civarında bir lif inceliğine karşılık gelir. Bu sınırın altına indikçe (Super 150s, 180s) kumaş elde adeta ipek gibi bir akıcılık kazanır; ancak elastikiyet düşer ve günlük kullanımda diz / dirsek bölgeleri çabuk parlaklaşır. Atölye olarak müşteriye 'her gün giyilecek bir ceket' için Super 110s–130s aralığını öneririz; özel davet ceketlerinde ise 150s ve üzerine çıkmaktan çekinmeyiz.",
                    "İplik numarası (Nm — number metric) ise tamamen farklı bir hikayedir. Nm 60/2 yazan bir kumaş, 1 gram ipliğin 60 metre olduğunu ve iki katlı büküm yapıldığını söyler. Kat sayısı arttıkça (örneğin Nm 100/2) kumaşın çekme dayanımı, ütü tutması ve sıçramazlığı artar. Bu yüzden 'Super 130s, two-ply, twisted yarn' yazan bir denimle 'Super 130s single-ply' aynı performansta değildir.",
                    "Bir takım elbise tasarımında biz şu üçlüyü birlikte değerlendiririz: lif inceliği, iplik katı ve gramaj. 280–310 g/m² aralığı dört mevsim kullanım için ideal düşüşü verir; altına inildikçe kumaş yapı kaybeder, üstüne çıkıldıkça kış ceketinin karakteri belirir.",
                    "Sonuç: 'Super 130s' yazısını gördüğünüzde sorulması gereken iki ek soru var — kaç katlı bükülmüş ve gramajı kaç? Bu üç değer ceketin omuzdan göğse, beldekı oturuştan eteğe kadar nasıl döküleceğini matematiksel olarak belirler. Kumaşı eline alan ustanın 'bu güzel düşer' demesi tesadüf değil, bu üç değişkenin sezgisel okumasıdır."
                ),
                "Erdal Güda Atölye",
                "6 dk",
                LocalDateTime.now().minusDays(18)
            ),
            new BlogPostSeed(
                "yaka-kalibi-geometrisi-notch-peak-shawl",
                "Yaka Kalıbı Geometrisi: Notch, Peak ve Shawl Yakalardaki Açı Matematiği",
                "Kalıp & Kesim",
                "Notch yaka 75°, peak yaka 105–120°, shawl yaka 0° — yakanın aldığı açı sadece estetik değil; ceketin gövde ile konuştuğu ortak bir geometri dilidir.",
                String.join("\n\n",
                    "Bir ceket yakası, üst yaka (top collar), alt yaka (under collar) ve revers (lapel) parçalarının üç boyutlu birleşiminden oluşur. Bu üç parçanın kesim açıları, ceketin omuz hattıyla nasıl iletişim kuracağını belirler.",
                    "Notch (çentikli) yakada üst yaka ile revers arasındaki standart açı 70–80 derecedir. Daha kapalı (70°) bir notch günlük iş ceketinin sessiz, dingin karakterini verir; daha açık (90°+) bir notch sportif ve modern bir his uyandırır. 75° atölyemizin varsayılan değeridir — klasikle modern arasında bir denge sunar.",
                    "Peak (sivri) yaka ise reversin yukarı bakan keskin uçlarıyla tanımlanır. Buradaki kritik ölçü, peak ucunun yatay eksene göre açısıdır: 105–120° arası 'iddialı klasik' bir karakter verirken, 130°+ açılar avant-garde / podyum tarzına kayar. Çift sıra düğmeli ceketlerde peak yaka standarttır çünkü çapraz örtüşmenin getirdiği görsel ağırlığı dengeler.",
                    "Shawl yaka teknik olarak 'köşesiz yaka'dır. Buradaki açı 0° — revers ile üst yaka arasında bir kesim yoktur; tek parça olarak akar. Bu, smokin için ideal bir formdur çünkü ipek satin kaplama tek bir eğriyi takip eder ve ışığı kesintisiz yansıtır.",
                    "Kalıp aşamasında bu açıları nasıl ölçeriz? Aslında konuşurken referans aldığımız çoğu açı, 'gorge line' dediğimiz hattan başlar — yaka ile reversin birleştiği o yatay/eğik çizgidir. Gorge ne kadar yüksek olursa ceket o kadar 'genç' ve 'modern' algılanır; ne kadar düşük olursa 'klasik' ve 'oturmuş' bir görünüm kazanır. Beden tipine göre gorge yüksekliği omuz hattından 6 ile 11 cm arasında değişir.",
                    "Yakayı çizmek, bir cetvel işi değildir. Müşterinin boyun-omuz açısını, göğüs çıkıntısını ve duruş postürünü ölçü kağıdına aktardıktan sonra bu açıları biz, yaklaşık 40 yıllık birikimle, elle çizeriz. Aynı 'notch yaka' iki farklı müşteride farklı açılarda kesilir — çünkü ceket vücuda yaslandığında yakanın yataylığı kişiye özeldir."
                ),
                "Erdal Güda Atölye",
                "7 dk",
                LocalDateTime.now().minusDays(12)
            ),
            new BlogPostSeed(
                "iceri-yapilan-pad-stitching-tela-canvas",
                "Ceketin Görünmeyen İskeleti: Pad-Stitching, Tela ve Canvas Konstrüksiyonu",
                "Üretim Süreçleri",
                "Bir ceketin neden 'oturduğunu' bedene dışarıdan bakan kişi anlamaz — cevap görünmeyen iç katmanda, elle dikilen tela ve canvas çalışmasındadır.",
                String.join("\n\n",
                    "Hazır giyim mağazasında elinize aldığınız ceketle, atölyede dikilen bir ceketin omuzdan göğse kadar 'yaşaması' arasındaki temel fark, dış kumaşta değil — içerideki konstrüksiyon katmanındadır. Buna 'inner structure' veya 'canvas construction' denir.",
                    "Tam canvas (full canvas) yapımda ceketin tüm ön bedeni, omuzdan eteğe kadar at kılı (horsehair) ve yün karışımı bir canvas ile kaplanır. Bu canvas serbest yüzer — yani dış kumaşa makineyle değil, elle teyellenir. Sonuçta ceket vücutla birlikte hareket eder, üzerine konan ütünün izini saklar ve yıllar içinde formunu kaybetmez.",
                    "Yarı canvas (half canvas) bu yapının sadece üst yarısında uygulanır; alt bel ve etek bölgesi termal yapışkanlı tela ile birleştirilir. Bu, atölyenin sıkça başvurduğu makul bir tercihtir: tam canvas'ın hareket avantajını korurken yaklaşık %35 üretim süresi kazandırır.",
                    "Pad-stitching ise canvas'ın gerçek karakterini belirleyen el dikiş tekniğidir. Yaka revers bölgesini düşünün: dışarıdan tek bir düz parça gibi görünse de, içeride canvas elle bin bir küçük 'V' deseninde dikilir. Bu dikişler kumaşı yaka kıvrımı boyunca üç boyutlu bir eğriye zorlar — yaka tek bir doğrultuya değil, müşterinin göğsüne göre eğrilir.",
                    "Tipik bir ceket revers pad-stitching işi 800–1200 dikiş içerir ve atölyemizde tek bir usta tarafından 90–120 dakikada tamamlanır. Bu dikişler tamamen iç tarafta kaldığından müşteri görmez; ancak ceketi taktığında 'omuzun nasıl bu kadar rahat oturduğunu' sezgisel olarak anlar.",
                    "Tela seçimi de görünmez ama belirleyici bir parametredir. Hair canvas için Almanya / İtalya menşeli at kılı yünü karışım belirler. Bu canvas 'bias' yönünde (eğik) kesildiğinde esneklik kazanır ve göğsün üç boyutlu eğrisini takip eder. Düz kesilirse — ki sanayi tipi üretimde yapılan budur — ceket düz bir tahta gibi durur ve özellikle göğüs ile omuz arası gerilir.",
                    "Bu yüzden 'bizim ceketimiz pahalıdır' sözünün ardında bu görünmez katmanın 6–8 saatlik el emeği vardır. Ceketi açıp astar içine baktığınızda canvas'ı görmezsiniz — ama her hareket ettiğinizde o orada olduğunu hissedersiniz."
                ),
                "Erdal Güda Atölye",
                "8 dk",
                LocalDateTime.now().minusDays(6)
            ),
            new BlogPostSeed(
                "dikis-iplik-cesitleri-buhar-pres",
                "Buhar, Pres ve Form: Bir Ceketin Üç Boyuta Geçirilme Süreci",
                "Üretim Süreçleri",
                "Düz kesilmiş yün, müşterinin göğüs eğrisine, omuz düşüşüne ve sırt yatımına nasıl uyar? Cevap, buharın yünü geçici olarak şekillendirilebilir bir malzemeye dönüştürmesinde yatıyor.",
                String.join("\n\n",
                    "Bir ceket parçası ilk kesildiğinde dümdüzdür — yani iki boyutludur. Vücut ise üç boyutlu. Bu farkı kapatmanın iki yolu vardır: birincisi kumaşı kıvırarak (dart, pli) ek dikişler atmak; ikincisi kumaşı buhar ve baskıyla form vermek. Atölyemizde tercih edilen yol her zaman ikincisidir, çünkü ek dikiş gerek görsel olarak kaba, gerek dökümünü bozar.",
                    "Yün lifi, suyun varlığında geçici olarak yumuşar — biyokimyasal olarak söylersek, lifteki disülfit bağları yüksek sıcaklık ve nemde gevşer. Soğuduğunda bağlar yeni pozisyonda donar. Bu 'gevşet-şekillendir-dondur' döngüsü, bir ceketin omuz çıkıntısını veya göğüs eğrisini elde etmemizin yegane yoludur.",
                    "Tipik bir pres işlemi şu adımları içerir: kumaş nemlendirilir (sprey veya nemli bez), bir ahşap form (örneğin omuz tahtası) üzerine yerleştirilir, üzerine ütü dik açıyla bastırılır ve 6–8 saniye sabit kalır. Ütü kaldırıldığında kumaş soğutulur — bu kritiktir, çünkü hala sıcakken hareket ettirilirse form gider. Bu yüzden atölyemizdeki ütülerin yanında her zaman küçük bir bez yelpaze vardır; bu, ısının hızlı kaçmasını sağlar.",
                    "Göğüs presi, kalitesi en zor öğrenilen iştir. Ceket önünün göğüs hizasında 1.5–2.5 cm'lik bir çıkıntı verilir; bu çıkıntı kumaşı kıvırmadan, sadece dokunun büküm yönünü değiştirerek elde edilir. Yeni başlayan bir kalfa için bu yaklaşık 6 ay süren bir öğrenmedir; sıcaklığı doğru ayarlamak, ütüyü doğru yönlerde hareket ettirmek ve kumaşın 'memory'sini hissetmek el alışkanlığıyla gelir.",
                    "Sırt için ise tam tersi bir hareket uygulanır: omuz altı ile bel arası bölge hafifçe geriye doğru çekilir. Bu, ceketin sırt hattının düz olmamasını ve müşterinin doğal omurga eğrisine uymasını sağlar. Modern hazır giyim bu adımı atlar; bu yüzden hazır ceketler arkadan 'dümdüz bir levha' gibi görünür ve müşterinin ensesinden hafif bir boşluk verir.",
                    "Ütüleme aslında dikiş kadar — hatta daha çok — önemli bir süreçtir. Bizim atölyemizde bir ceket toplamda 35–55 ütü/pres seansından geçer. Her seans 10–60 saniye arası sürer ve kumaşın belirli bir bölgesine farklı bir form verir. Müşteri ceketi aldığında bu emeği sayısal olarak bilmez; sadece omuzun rahat oturduğunu, göğsün sıkıştırmadığını ve sırtın doğal bir eğri tuttuğunu fark eder. Bizim için yeterli olan da budur."
                ),
                "Erdal Güda Atölye",
                "8 dk",
                LocalDateTime.now().minusDays(2)
            )
        );

        for (BlogPostSeed seed : seeds) {
            if (blogPostRepository.existsBySlug(seed.slug)) continue;
            BlogPost post = new BlogPost();
            post.setSlug(seed.slug);
            post.setTitle(seed.title);
            post.setCategory(seed.category);
            post.setSummary(seed.summary);
            post.setBody(seed.body);
            post.setAuthor(seed.author);
            post.setReadTime(seed.readTime);
            post.setPublishedAt(seed.publishedAt);
            blogPostRepository.save(post);
        }
    }

    private record BlogPostSeed(
        String slug,
        String title,
        String category,
        String summary,
        String body,
        String author,
        String readTime,
        LocalDateTime publishedAt
    ) {}

    private void applyCompatibilityFixes() {
        jdbcTemplate.execute("alter table if exists orders drop constraint if exists orders_status_check");
        jdbcTemplate.execute("alter table if exists orders add column if not exists currency varchar(10)");
        jdbcTemplate.execute("alter table if exists orders add column if not exists payment_status varchar(20)");
        jdbcTemplate.execute("update orders set currency = 'TRY' where currency is null");
        jdbcTemplate.execute("update orders set payment_status = 'UNPAID' where payment_status is null");
    }

    private Map<String, Employee> seedEmployeesIfNeeded() {
        Map<String, String> seedEmployees = new LinkedHashMap<>();
        seedEmployees.put("Ufuk Baş", "Satış ve Ölçü Sorumlusu");
        seedEmployees.put("Şükran Özcan", "Kesimhane Sorumlusu");
        seedEmployees.put("Gamze Dalyan", "Kargo Hazırlık Sorumlusu");
        seedEmployees.put("Musa Katok", "Kargo Sorumlusu");
        seedEmployees.put("Seyfi Erol", "Ütü Sorumlusu");
        seedEmployees.put("Kemal Erbaş", "1. Kademe Makinacı");
        seedEmployees.put("Abdülkadir Suriyeli", "2. Kademe Makinacı");
        seedEmployees.put("Mehmet Şirin", "Pantolon Makinacı");
        seedEmployees.put("Hasan Sevinç", "Kontrol ve Revize Sorumlusu");
        seedEmployees.put("Erdal Güda", "Genel Kontrol");

        seedEmployees.forEach((fullName, roleTitle) ->
            employeeRepository.findByFullName(fullName).orElseGet(() -> {
                Employee employee = new Employee();
                employee.setFullName(fullName);
                employee.setRoleTitle(roleTitle);
                employee.setActive(true);
                return employeeRepository.save(employee);
            })
        );

        Map<String, Employee> employees = new LinkedHashMap<>();
        seedEmployees.keySet().forEach(fullName -> employees.put(
            fullName,
            employeeRepository.findByFullName(fullName)
                .orElseThrow(() -> new IllegalStateException("Seed employee not found: " + fullName))
        ));
        return employees;
    }

    private void seedProductionStagesIfNeeded(Map<String, Employee> employees) {
        createStageIfMissing(1, "Ölçü / Satış", "Müşteri ihtiyacı alınır, ürün ve ölçü süreci başlatılır.", employees.get("Ufuk Baş"));
        createStageIfMissing(2, "Kesimhane", "Kalıp ve kesim hazırlığı yapılır.", employees.get("Şükran Özcan"));
        createStageIfMissing(3, "Kargo Hazırlık", "Kesilen işler sevkiyata hazırlanır.", employees.get("Gamze Dalyan"));
        createStageIfMissing(4, "Ankara’dan İzmir’e Sevkiyat", "Ürün parçaları İzmir üretim hattına gönderilir.", employees.get("Gamze Dalyan"));
        createStageIfMissing(5, "İzmir Kargo Teslim Alma", "Sevkiyat İzmir tarafında teslim alınır.", employees.get("Musa Katok"));
        createStageIfMissing(6, "İzmir Fabrika Hazırlık / Ara Ütü", "Üretim öncesi hazırlık ve ara ütü işlemleri yapılır.", employees.get("Seyfi Erol"));
        createStageIfMissing(7, "1. Kademe Makina", "İlk makine üretim aşaması tamamlanır.", employees.get("Kemal Erbaş"));
        createStageIfMissing(8, "2. Kademe Makina", "İkinci makine üretim aşaması tamamlanır.", employees.get("Abdülkadir Suriyeli"));
        createStageIfMissing(9, "3. Kademe Makina / Pantolon", "Pantolon ve üçüncü kademe makine işleri yürütülür.", employees.get("Mehmet Şirin"));
        createStageIfMissing(10, "Son Ütü", "Ürün son ütü ve form kontrolünden geçer.", employees.get("Seyfi Erol"));
        createStageIfMissing(11, "İzmir’den Ankara’ya Kargo", "Tamamlanan ürün Ankara’ya sevk edilir.", employees.get("Musa Katok"));
        createStageIfMissing(12, "Ankara Kargo Teslim Alma", "Ankara teslim alma işlemi yapılır.", employees.get("Ufuk Baş"));
        createStageIfMissing(13, "Kontrol / Revize", "Son kontrol ve gerekiyorsa revize süreci yürütülür.", employees.get("Hasan Sevinç"));
        createStageIfMissing(14, "Müşteriye Teslim", "Ürün müşteri teslimine hazırlanır ve teslim edilir.", employees.get("Ufuk Baş"));
        createStageIfMissing(15, "Genel Kontrol / Sonuçlandırma", "Genel kontrol yapılır ve üretim işi sonuçlandırılır.", employees.get("Erdal Güda"));
    }

    private void createStageIfMissing(Integer stageOrder, String name, String description, Employee employee) {
        if (productionStageRepository.findByStageOrder(stageOrder).isPresent()) {
            return;
        }

        ProductionStage stage = new ProductionStage();
        stage.setStageOrder(stageOrder);
        stage.setName(name);
        stage.setDescription(description);
        stage.setDefaultResponsibleEmployee(employee);
        stage.setActive(true);
        productionStageRepository.save(stage);
    }

    private void seedUsersIfNeeded(Map<String, Employee> employees) {
        createUserIfMissing("erdal.guda", "Erdal Güda", UserRole.ADMIN, employees.get("Erdal Güda"));
        createUserIfMissing("ufuk.bas", "Ufuk Baş", UserRole.SALES, employees.get("Ufuk Baş"));
        createUserIfMissing("sukran.ozcan", "Şükran Özcan", UserRole.CUTTING, employees.get("Şükran Özcan"));
        createUserIfMissing("gamze.dalyan", "Gamze Dalyan", UserRole.PACKAGING, employees.get("Gamze Dalyan"));
        createUserIfMissing("musa.katok", "Musa Katok", UserRole.CARGO, employees.get("Musa Katok"));
        createUserIfMissing("seyfi.erol", "Seyfi Erol", UserRole.IRONING, employees.get("Seyfi Erol"));
        createUserIfMissing("kemal.erbas", "Kemal Erbaş", UserRole.MACHINIST, employees.get("Kemal Erbaş"));
        createUserIfMissing("abdulkadir.suriyeli", "Abdülkadir Suriyeli", UserRole.MACHINIST, employees.get("Abdülkadir Suriyeli"));
        createUserIfMissing("mehmet.sirin", "Mehmet Şirin", UserRole.MACHINIST, employees.get("Mehmet Şirin"));
        createUserIfMissing("hasan.sevinc", "Hasan Sevinç", UserRole.QUALITY_CONTROL, employees.get("Hasan Sevinç"));
    }

    private void createUserIfMissing(
        String username,
        String fullName,
        UserRole role,
        Employee employee
    ) {
        if (userRepository.existsByUsername(username)) {
            return;
        }

        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(DEFAULT_SEEDED_PASSWORD));
        user.setFullName(fullName);
        user.setEmail(username + LOCAL_EMAIL_DOMAIN);
        user.setRole(role);
        user.setEmployee(employee);
        user.setActive(true);
        userRepository.save(user);
    }
}
