const fetchExamRoomsAndInvigilators = async (examId) => {
    setLoading(true);
    
    // 1. seating_plans tablosundan ilgili sınavın assignments verisini çekelim
    const { data: seatingData, error: seatingError } = await supabase
      .from('seating_plans')
      .select('assignments')
      .eq('exam_id', examId);

    if (!seatingError && seatingData && seatingData.length > 0) {
      // JSONB içindeki tüm room_id'leri toplayalım
      const roomIds = new Set();
      seatingData.forEach(row => {
        const assignments = row.assignments;
        if (Array.isArray(assignments)) {
          assignments.forEach(item => {
            if (item.room_id) roomIds.add(item.room_id);
          });
        }
      });

      const roomIdList = Array.from(roomIds);

      if (roomIdList.length > 0) {
        // 2. rooms tablosundan bu ID'lere ait gerçek salon adlarını çekelim
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .in('id', roomIdList);

        if (!roomsError && roomsData) {
          // Salon ID'sini salon adıyla eşleştiren bir sözlük oluşturalım (Tablondaki salon adı sütunu 'name' veya 'room_name' olabilir)
          const roomMap = {};
          roomsData.forEach(r => {
            roomMap[r.id] = r.name || r.room_name || r.title || `Salon ${r.id.slice(0, 4)}`;
          });

          // Benzersiz salon isimlerini liste yapalım
          const uniqueRoomNames = [...new Set(roomIdList.map(id => roomMap[id]).filter(Boolean))];
          setExamRooms(uniqueRoomNames);
        } else {
          setExamRooms([]);
        }
      } else {
      setHeaderRoomsEmpty:
        setExamRooms([]);
      }

      // 3. Daha önce kaydedilmiş gözetmen atamalarını çekelim
      const { data: invData, error: invError } = await supabase
        .from('exam_invigilators')
        .select('*')
        .eq('exam_id', examId);

      if (!invError && invData) {
        const map = {};
        invData.forEach(item => {
          map[item.room_name] = {
            invigilator: item.invigilator_name || '',
            notes: item.notes || ''
          };
        });
        setInvigilatorsData(map);
      }
    } else {
      setExamRooms([]);
    }
    setLoading(false);
  };
