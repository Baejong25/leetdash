import java.util.PriorityQueue;

class Solution {
	public int solution(int[] scoville, int K) {
		int answer = 0;

		PriorityQueue<Integer> pq = new PriorityQueue<>();

		for (int scov : scoville) {
			pq.add(scov);
		}

		while (pq.size() >= 2 && pq.peek() < K) {
			int first = pq.poll();
			int secon = pq.poll();

			pq.add(first + secon * 2);
			answer++;
		}

		if (pq.peek() >= K) {
			return answer;
		} else {
			return -1;
		}
	}
}
