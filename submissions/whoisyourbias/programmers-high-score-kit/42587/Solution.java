// priorities의 길이는 1 이상 100 이하입니다.
// priorities의 원소는 1 이상 9 이하의 정수입니다.
// priorities의 원소는 우선순위를 나타내며 숫자가 클 수록 우선순위가 높습니다.
// location은 0 이상 (대기 큐에 있는 프로세스 수 - 1) 이하의 값을 가집니다.
// priorities의 가장 앞에 있으면 0, 두 번째에 있으면 1 … 과 같이 표현합니다.

import java.util.Arrays;
import java.util.LinkedList;

class Solution {
	public int solution(int[] priorities, int location) {
		int answer = 0;

		LinkedList<Pair> lst = new LinkedList<>();
		for (int i = 0; i < priorities.length; i++) {
			lst.add(new Pair(priorities[i], i));
		}

		Arrays.sort(priorities);

		int pi = priorities.length - 1;

		while (pi >= 0) {
			int cur_pi = priorities[pi];
			Pair polled = lst.pollFirst();

			if (polled.v == cur_pi) {

				if (polled.idx == location) {
					answer = priorities.length - lst.size();
				}

				pi--;
			} else {
				lst.add(polled);
			}
		}

		return answer;
	}

	class Pair {
		int v;
		int idx;

		Pair(int v, int idx) {
			this.v = v;
			this.idx = idx;
		}
	}
}
