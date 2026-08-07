import java.util.*; 
class Solution {
    public int[] solution(int[] answers) {
        // 정답을 담을 배열 
        ArrayList<Integer> result = new ArrayList<>(); 
        
        // 수포자 답안 
        int[] person1 = {1,2,3,4,5}; 
        int[] person2 = {2,1,2,3,2,4,2,5}; 
        int[] person3 = {3,3,1,1,2,2,4,4,5,5}; 
        
        int score1 = 0;
        int score2 = 0;
        int score3 = 0; 
        
        // 문제 순회
        for (int i = 0; i < answers.length; i++) {
            // 정답과 수포자들의 답안 비교 
            if (answers[i] == person1[i % person1.length]) score1++; 
            if (answers[i] == person2[i % person2.length]) score2++; 
            if (answers[i] == person3[i % person3.length]) score3++; 
        }
        
        // 가장 높은 점수 
        result.add(score1);
        result.add(score2); 
        result.add(score3); 
        int high = Integer.MIN_VALUE; 
        
        // 높은 점수 여럿 -> return 오름차순 정렬 
        ArrayList<Integer> answer = new ArrayList<>(); 
        for (int num : result){
            if (num >= high) {
                high = num;
            }
        }
        for (int i = 0; i < result.size(); i++) {
            if (result.get(i) == high){
                answer.add(i+1); 
            }
        }
        
        int[] arr = new int[answer.size()]; 
        for (int i = 0; i < answer.size(); i++) {
            arr[i] = answer.get(i);
        }
        return arr; 
    }
}