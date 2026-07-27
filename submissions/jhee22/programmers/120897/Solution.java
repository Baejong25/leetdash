import java.util.ArrayList; 
import java.util.Collections; 

class Solution {
    public int[] solution(int n) {
        ArrayList<Integer> answer = new ArrayList<>(); 
        int targetNumber = (int) (Math.sqrt(n)) + 1;  
        for (int i = 1; i < targetNumber; i ++){
            if (n % i == 0){
                answer.add(i); 
                // 제곱근일때 
                if (Math.pow(i,2) != n){
                    answer.add(n /i); 
                }
            }
        }
        Collections.sort(answer); 
        int[] result = new int[answer.size()]; 
        
        for (int i = 0; i < answer.size(); i++){
            result[i] = answer.get(i); 
        }
        return result; 
    }
}