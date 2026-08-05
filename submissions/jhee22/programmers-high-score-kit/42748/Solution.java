import java.util.*; 
class Solution {
    public int[] solution(int[] array, int[][] commands) {
        ArrayList<Integer> answer = new ArrayList<>(); 
        for (int i = 0; i < commands.length; i++) {
            ArrayList<Integer> result = new ArrayList<>(); 
            int start = 0; 
            int end = 0; 
            int loc = 0; 
            for (int j = 0; j < commands[i].length; j++) {
                start =  commands[i][0]; 
                end = commands[i][1]; 
                loc = commands[i][2]; 
            }
            // 2 (1)  
            for (int k = start-1; k < end; k++){
                // System.out.println(array[k]); 
                result.add(array[k]);
            }
            // System.out.println(result);
            
            // 정렬 
            Collections.sort(result); 
            answer.add(result.get(loc-1)); 
            
        }
        
        int[] arr = new int[answer.size()]; 
        for (int i = 0; i < answer.size(); i++) {
            arr[i] = answer.get(i); 
        }
        return arr; 
    }
}