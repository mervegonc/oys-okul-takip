const [invigilators, setInvigilators] = useState({});
  const [savedInvigilatorsList, setSavedInvigilatorsList] = useState([]); // Daha önce kaydedilmiş gözetmen havuzu

  useEffect(() => {
    fetchExams();
    fetchRooms();
    fetchAllStudentsData();
  }, []);

  // Sınav seçildiğinde o sınava ait gözetmenleri ve genel gözetmen havuzunu çek
  useEffect(() => {
    if (selectedExam) {
      fetchExamInvigilators(selectedExam.id);
      fetchSavedInvigilators();
    }
  }, [selectedExam]);

  const fetchExamInvigilators = async (examId) => {
    try {
      const { data, error } = await supabase
        .from('exam_invigilators')
        .select('*')
        .eq('exam_id', examId);

      if (!error && data) {
        const invMap = {};
        data.forEach(item => {
          invMap[item.room_name] = item.invigilator_name;
        });
        setInvigilators(invMap);
      }
    } catch (err) {
      console.error('Gözetmenler yüklenirken hata:', err);
    }
  };

  const fetchSavedInvigilators = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_invigilators')
        .select('invigilator_name');

      if (!error && data) {
        // Benzersiz (tekil) gözetmen isimlerini listele
        const uniqueNames = [...new Set(data.map(item => item.invigilator_name))].sort();
        setSavedInvigilatorsList(uniqueNames);
      }
    } catch (err) {
      console.warn('Gözetmen havuzu okunamadı:', err);
    }
  };
