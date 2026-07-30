import java.util.*; 
class Solution {
    public int[] solution(int[] progresses, int[] speeds) {
        // cnt 를 넣을 정답 리스트 선언 
        ArrayList <Integer> result = new ArrayList<>(); 
        
        // Queue 에 값 넣기 
        Queue <Integer> queue = new ArrayDeque<>(); 
        for (int i = 0; i < progresses.length; i++) { 
            int rest = (int) Math.ceil( (double) (100 - progresses[i]) / speeds[i]); 
            queue.offer(rest); 
        }
        // Queue 순회
        while (!queue.isEmpty()) {
            // 이번 배포의 기준 날짜, 배포 개수 (이번 배포 포함이니까 1부터 시작 )
            int val = queue.poll(); 
            int cnt = 1;    
            
            // 비교만 하고 싶을 때는 peek() 
            while (!queue.isEmpty() && val >= queue.peek()) {
                // 다음 값 제거 
                queue.poll();
                cnt++; 
            }
            
            result.add(cnt); 
            
        }
        
        int[] answer = new int[result.size()]; 
        for (int i = 0; i < result.size(); i++) {
            answer[i] = result.get(i); 
        }
        
        return answer; 
    }
}