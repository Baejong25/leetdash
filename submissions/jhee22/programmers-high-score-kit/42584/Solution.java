import java.util.*;
class Solution {
    public int[] solution(int[] prices) {
        // Queue 선언 
        Queue<Integer> queue = new ArrayDeque<>(); 
        for (int i = 0; i < prices.length; i++) {
            queue.add(prices[i]); 
        }
        
        ArrayList<Integer> result = new ArrayList<>(); 
        while(!queue.isEmpty()) {
            int time = 0; 
            boolean flag = true; 
            int curr = queue.poll(); 
            
            // 본인보다 작거나 같으면 반복 스탑 
            for (int p: queue) {
                time++; 
                if (curr > p) {
                    break; 
                } 
            }
            result.add(time); 
        
        }
        int[] answer = new int[result.size()]; 
            for (int i = 0; i < result.size(); i++){
                answer[i] = result.get(i); 
        }
        
        return answer; 
    }
}