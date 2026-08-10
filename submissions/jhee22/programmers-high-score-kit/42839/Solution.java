// 주어진 문자열로 조합할 수 있는 숫자의 개수 구현 
// DFS(재귀) 

import java.util.*; 
class Solution { 
    // 탐색하는 역할 : 탐색 도는 배열, 지금까지 만든 문자열, 방문기록 
    public void dfs(String numbers, String curr, boolean[] visited, HashSet set) {
         for (int i = 0; i < numbers.length(); i++) {
            // 이미 방문한 적이 있다면 빠수 
            if (visited[i]) {
                continue; 
            }
            // 방문 표시 
            visited[i] = true; 
            
            // 다음에 조합할 문자열 
            String next = curr + numbers.charAt(i); 
            set.add(next); 
             
            // next 를 가지고 다시 dfs 호출 
            dfs(numbers, next, visited, set); 
            
            // i 번쨰 문자 사용 취소 
            visited[i] = false; 
        
        }
    }
    public int solution(String numbers) {
        HashSet<Integer> cnt = new HashSet<>(); 
        boolean[] visited = new boolean[numbers.length()]; 
        String curr = "";
        // 만든 숫자 조합을 담을 HashSet (반복을 피하기 위함)
        // HashSet 은 solution 안의 지역변수이기 때문에, 넘기고 싶으면 dfs 에도 params 정의해서 넘겨야함 
        HashSet<String> set = new HashSet<>(); 
        dfs(numbers, curr, visited, set); 
        
        // 문자열 조합 잘 만들었는지 확인 
        // System.out.println(set);  
        
        // 소수 찾는 로직 시작 -> 제곱근 어쩌구 저쩌구로 풀어야지 
        for (String s: set) {
            int num = Integer.parseInt(s); 
            boolean flag = true; 
            for (int i = 2; i <=  Math.sqrt(num); i++){
                if (num % i == 0) {
                    flag = false; 
                    continue; 
                }    
            }
            if (flag){
                if (num > 1){
                    System.out.println(num); 
                    cnt.add(num); 
                } 
            }
                    
        } 
        
        
        return cnt.size();       
            
    }            
}