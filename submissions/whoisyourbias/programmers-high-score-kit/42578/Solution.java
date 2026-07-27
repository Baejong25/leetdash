/*
clothes의 각 행은 [의상의 이름, 의상의 종류]로 이루어져 있습니다.
코니가 가진 의상의 수는 1개 이상 30개 이하입니다.
같은 이름을 가진 의상은 존재하지 않습니다.
clothes의 모든 원소는 문자열로 이루어져 있습니다.
모든 문자열의 길이는 1 이상 20 이하인 자연수이고 알파벳 소문자 또는 '_' 로만 이루어져 있습니다.
*/

import java.util.HashMap;
import java.util.Map.Entry;

class Solution {
	public int solution(String[][] clothes) {
		int answer = 1;

		HashMap<String, Integer> m = new HashMap<>();

		for (String[] cloth : clothes) {
			m.put(cloth[1], m.getOrDefault(cloth[1], 0) + 1);
		}

		for (Entry<String, Integer> e : m.entrySet()) {
			answer *= e.getValue() + 1;
		}
		return answer - 1;
	}
}
