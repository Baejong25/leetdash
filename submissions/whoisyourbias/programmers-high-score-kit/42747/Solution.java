import java.util.PriorityQueue;

class Solution {
	public int solution(int[] citations) {
		PriorityQueue<Integer> pq = new PriorityQueue<>();

		int max = 0;
		for (int citate : citations) {
			pq.add(citate);
			if (citate > max)
				max = citate;
		}

		int max_h = 0;
		for (int h = 0; h <= max; h++) {
			while (pq.peek() < h) {
				pq.poll();
			}
			if (pq.size() >= h) {
				max_h = h;
			}
		}

		return max_h;
	}
}
