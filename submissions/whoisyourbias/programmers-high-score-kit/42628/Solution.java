import java.util.TreeMap;

// operations는 길이가 1 이상 1,000,000 이하인 문자열 배열입니다.
// operations의 원소는 큐가 수행할 연산을 나타냅니다.
// 원소는 “명령어 데이터” 형식으로 주어집니다.- 최댓값/최솟값을 삭제하는 연산에서 최댓값/최솟값이 둘 이상인 경우, 하나만 삭제합니다.
// 빈 큐에 데이터를 삭제하라는 연산이 주어질 경우, 해당 연산은 무시합니다.
class Solution {
	public int[] solution(String[] operations) {
		int[] answer = { 0, 0 };

		TreeMap<Integer, Integer> m = new TreeMap<>();

		for (String op : operations) {
			if (op.charAt(0) == 'I') {
				String str = op.substring(2);
				int v = Integer.valueOf(str);
				m.put(v, m.getOrDefault(v, 0) + 1);
			} else {
				if (m.isEmpty())
					continue;
				if (op.charAt(2) == '-') {
					if (m.firstEntry().getValue() >= 2)
						m.put(m.firstKey(), m.firstEntry().getValue() - 1);
					else
						m.pollFirstEntry();
				} else {
					if (m.lastEntry().getValue() >= 2)
						m.put(m.lastKey(), m.lastEntry().getValue() - 1);
					else
						m.pollLastEntry();
				}
			}
		}

		if (m.isEmpty())
			return answer;
		answer[0] = m.lastKey();
		answer[1] = m.firstKey();

		return answer;
	}
}
