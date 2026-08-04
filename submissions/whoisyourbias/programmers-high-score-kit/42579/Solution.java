//genres[i]는 고유번호가 i인 노래의 장르입니다.
// plays[i]는 고유번호가 i인 노래가 재생된 횟수입니다.
// genres와 plays의 길이는 같으며, 이는 1 이상 10,000 이하입니다.
// 장르 종류는 100개 미만입니다.
// 장르에 속한 곡이 하나라면, 하나의 곡만 선택합니다.
// 모든 장르는 재생된 횟수가 다릅니다.

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.Map.Entry;

class Solution {
    public int[] solution(String[] genres, int[] plays) {
        int[] answer = {};


		// 장르별 가장 많이 재생된 노래를 2개씩 모아서 베스트앨범출시
		//
		// 노래는 고유번호로 구분.
		Map<String, ArrayList<PlaysIdx>> genresPlays = new HashMap<>();

		for (int i = 0; i < plays.length; i++) {
			if (genresPlays.get(genres[i]) == null)
				genresPlays.put(genres[i], new ArrayList<PlaysIdx>());
			genresPlays.get(genres[i]).add(new PlaysIdx(plays[i], i));
		}

		TreeMap<Integer, String> m = new TreeMap<>(new Comparator<Integer>() {
			@Override
			public int compare(Integer o1, Integer o2) {
				return o2 - o1;
			}
		});

		for (Entry<String, ArrayList<PlaysIdx>> e : genresPlays.entrySet()) {
		    Collections.sort(e.getValue(), new Comparator<PlaysIdx>() {
                public int compare(PlaysIdx o1, PlaysIdx o2) {
                    return o2.play - o1.play;
                    };
                }
            );
            // System.out.println(e.getValue().toString());
            int sum = 0;
			for (Object v: e.getValue().toArray()) {
				sum += ((PlaysIdx)v).play;
			}
			m.put(sum, e.getKey());
		}


		ArrayList<Integer> a = new ArrayList<>();

		for (Entry<Integer, String> e : m.entrySet()) {
			int c = 0;
			for (PlaysIdx pi: genresPlays.get(e.getValue()).toArray(new PlaysIdx[0])) {

				if (c == 2)
					break;
				a.add(pi.idx);
				c++;
			}

		}

		answer = new int[a.size()];
		for (int i = 0; i < a.size(); i++) {
			answer[i] = a.get(i);
		}

		return answer;
    }

	class PlaysIdx {
		int play;
		int idx;
		PlaysIdx(int play, int idx) {this.play = play; this.idx = idx;}
        @Override
        public String toString() {
            return "idx:" + idx + " play:" + play;
        }
	}
}
