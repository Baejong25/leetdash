import java.util.*;

class Solution {
    public int solution(int[] scoville, int K) {

        PriorityQueue<Integer> pq = new PriorityQueue<>();

        for (int i = 0; i < scoville.length; i++) {
            pq.offer(scoville[i]);
        }

        if (pq.peek() >= K) {
            return 0;
        }

        int count = 0;
        while (pq.size() > 1) {

            if (pq.peek() >= K) {
                break;
            }

            int a = pq.poll();
            int b = pq.poll();
            int c = a + (b * 2);

            pq.offer(c);
            count++;
        }

        if (pq.poll() < K) {
            return -1;
        }


        return count;
    }
}