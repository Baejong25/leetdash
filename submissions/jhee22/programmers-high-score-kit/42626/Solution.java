import java.util.*; 
class Solution {
    public int solution(int[] scoville, int K) {
        // Heap 선언 
        PriorityQueue<Integer> heap = new PriorityQueue<>(); 
        for (int i = 0; i < scoville.length; i++) {
            heap.offer(scoville[i]); 
        }
        
        // heap 의 최소값이 K보다 작을 때까지
        int cnt = 0;
        while (heap.peek() < K) { // 확인만!!
            // 만들 수 없는 경우 
            if (heap.size() < 2){
                return -1;
            } 
        
            // 빼고 
            int first = heap.poll(); 
            int second = heap.poll(); 
            int mixed = first + second * 2; 

            // 섞은 값 넣기  -> 섞은 횟수 증가 
            heap.offer(mixed); 
            cnt++; 
        }
        
        return cnt; 
             
    }
}